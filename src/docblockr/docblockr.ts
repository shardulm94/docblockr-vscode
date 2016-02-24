'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import * as util from './utils/common';
import * as parser from './parsers/helper';
import { BaseParser } from './parsers/base';
import XRegExp = require('xregexp');

export default class DocBlockr {

    private logger: ILogger;
    private config: Config;
    public keyPressed: string;

    private trailingRgn: vscode.Range;
    private trailingString: string;
    private indentSpaces: string;
    private prefix: string;
    private parser: BaseParser;
    private line: string;
    private deepAlignTags: boolean;
    private shallowAlignTags: boolean;

    constructor() {
        this.logger = Logger.getInstance();
        this.config = Config.getInstance();
    }

    public run(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, args: {} = {}): void {

        let inline: boolean = args["inline"] || false;

        this.initialize(editor, inline);

        if (this.parser.isExistingComment(this.line)) {
            // This line is used to strip the tabstops out from the snippet. The below function should be removed once
            // functionality to insert snippets dynamically is avaliable in vscode API
            this.indentSpaces = this.removeTabStops(this.indentSpaces);
            editorEdit.insert(editor.selection.active, "\n *" + this.indentSpaces);
            return
        }

        // match against a function declaration.
        let out: string[] = this.parser.parse(this.line)

        let snippet: string = this.generateSnippet(out, inline);

        // This line is used to strip the tabstops out from the snippet. The below function should be removed once
        // functionality to insert snippets dynamically is avaliable in vscode API
        snippet = this.removeTabStops(snippet);

        let trailingRgn: vscode.Range = this.trailingRgn;
        editor.edit(function(editBuilder: vscode.TextEditorEdit) {
            editBuilder.delete(trailingRgn);
        }).then(function() {
            editor.edit(function(editBuilder: vscode.TextEditorEdit) {
                editBuilder.insert(trailingRgn.start, snippet)
            });
        });

    }

    public insertSnippet(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, args: {} = {}): void {

        let contents: string = args["contents"] || "";

        // This line is used to strip the tabstops out from the snippet. The below function should be removed once
        // functionality to insert snippets dynamically is avaliable in vscode API
        contents = this.removeTabStops(contents);

        editorEdit.insert(editor.selection.active, contents);
    }

    private removeTabStops(str: string): string {
        str = XRegExp.replace(str, XRegExp('[$][{]\\d+:([^}]+)[}]'), "$1", 'all');
        str = XRegExp.replace(str, XRegExp('[$][{]\\d+:[}]'), "", 'all');
        return str;
    }

    private initialize(editor: vscode.TextEditor, inline: boolean = false): void {
        let point: vscode.Position = editor.selection.end;

        this.trailingRgn = new vscode.Range(point, editor.document.lineAt(point).range.end);
        this.trailingString = editor.document.getText(this.trailingRgn).trim();
        this.trailingString = util.escape(XRegExp.replace(this.trailingString, XRegExp('\\s*\\*\\/\\s*$'), ''));

        this.indentSpaces = " ".repeat(Math.max(0, this.config.get<number>('indentationSpaces')));
        this.prefix = "*";

        let settingsAlignTags: string = this.config.get<string>("alignTags") || 'deep';
        this.deepAlignTags = settingsAlignTags == 'deep';
        this.shallowAlignTags = settingsAlignTags == 'shallow';

        this.parser = parser.getParser(editor.document.languageId);
        this.parser.setInline(inline);

        // use trailing string as a description of the function
        if (this.trailingString)
            this.parser.setNameOverride(this.trailingString);

        let definitionRange: string[] = [];
        for (let i: number = point.line + 1; i <= point.line + 25; i++) {
            if (i >= editor.document.lineCount) break;
            definitionRange.push(editor.document.lineAt(i).text);
        }
        // read the next line
        this.line = this.parser.getDefinition(definitionRange);
    }

    private generateSnippet(out: string[], inline: boolean = false): string {
        // substitute any variables in the tags
        if (out)
            out = this.substituteVariables(out);

        // align the tags
        if (out && (this.shallowAlignTags || this.deepAlignTags) && !inline)
            out = this.alignTags(out);

        // fix all the tab stops so they're consecutive
        if (out)
            out = this.fixTabStops(out);

        if (inline) {
            if (out)
                return " " + out[0] + " */";
            else
                return " $0 */";
        }
        else {
            return this.createSnippet(out) + (this.config.get<boolean>('newlineAfterBlock') ? '\n' : '');
        }
    }

    private alignTags(out: string[]): string[] {
        function outputWidth(str: string): number {
            // get the length of a string, after it is output as a snippet,
            // "${1:foo}" --> 3
            return XRegExp.replace(str, XRegExp('[$][{]\\d+:([^}]+)[}]'), "$1").replace('\$', '$').length;
        }

        // count how many columns we have
        let maxCols: number = 0;
        // this is a 2d list of the widths per column per line
        let widths: number[][] = [];

        // Grab the return tag if required.
        let returnTag: string;
        if (this.config.get<boolean>('perSectionIndent'))
            returnTag = this.config.get<string>('returnTag') || '@return';
        else
            returnTag = null;

        for (let index: number = 0; index < out.length; index++) {
            let line: string = out[index];
            if (line.startsWith('@')) {
                // Ignore the return tag if we're doing per-section indenting.
                if (returnTag && line.startsWith(returnTag))
                    continue;
                // ignore all the words after `@author`
                let columns: string[] = (!line.startsWith('@author') ? line.split(" ") : ['@author']);
                widths.push(columns.map(outputWidth));
                maxCols = Math.max(maxCols, widths.slice(-1)[0].length);
            }
        }

        //  initialise a list to 0
        let maxWidths: number[] = new Array(maxCols);
        maxWidths.fill(0, 0, maxCols);

        if (this.shallowAlignTags)
            maxCols = 1;

        for (let i: number = 0; i < maxCols; i++) {
            for (let j: number = 0; j < widths.length; j++) {
                let width: number[] = widths[j];
                if (i < width.length) {
                    maxWidths[i] = Math.max(maxWidths[i], width[i]);
                }
            }
        }

        // Minimum spaces between line columns
        let minColSpaces: number = this.config.get<number>('minSpacesBetweenColumns') || 1;

        for (let index: number = 0; index < out.length; index++) {
            // format the spacing of columns, but ignore the author tag.
            let line: string = out[index];
            if (line.startsWith('@') && !line.startsWith('@author')) {
                let newOut: string[] = [];
                let lineSplit: string[] = line.split(" ");
                for (let partIndex: number = 0; partIndex < lineSplit.length; partIndex++) {
                    let part: string = lineSplit[partIndex];
                    newOut.push(part);
                    let repeats: number = (maxWidths[partIndex] ? maxWidths[partIndex] : 0) - outputWidth(part);
                    newOut.push(" ".repeat(minColSpaces) + (" ".repeat((repeats > 0) ? repeats : 0)));
                }
                out[index] = newOut.join("").trim();
            }
        }

        return out;
    }

    private substituteVariables(out: string[]): string[] {
        function getVar(match: string, varName: string) {
            if (varName == 'datetime') {
                let now: Date = new Date();
                let date: string = now.toISOString().split('T')[0] + 'T' + now.toLocaleTimeString();
                let offset: number = now.getTimezoneOffset() / -60;
                let offsetHours: number = Math.floor(Math.abs(offset));
                let offsetMinutes: number = (offset % 1) * 60;
                return date
                    + ((offset >= 0) ? '+' : '-')
                    + ((offsetHours < 10) ? ("0" + offsetHours) : ("" + offsetHours))
                    + ((offsetMinutes < 10) ? ("0" + offsetMinutes) : ("" + offsetMinutes));
            } else if (varName == 'date') {
                let now: Date = new Date();
                return now.toISOString().split('T')[0] + 'T' + now.toLocaleTimeString();
            } else {
                return match;
            }
        }

        function subLine(line: string): string {
            return XRegExp.replace(line, XRegExp('\\{\\{([^}]+)\\}\\}'), getVar, 'all');
        }

        return out.map(subLine);
    }

    private fixTabStops(out: string[]): string[] {
        let tabIndex: number = 0;

        function getTabIndex(): number {
            tabIndex++;
            return tabIndex;
        }

        function swapTabs(m: string, left: string, right: string): string {
            return left + getTabIndex() + right;
        }

        for (let index: number = 0; index < out.length; index++) {
            out[index] = XRegExp.replace(out[index], XRegExp('(\\$\\{)\\d+(:[^}]+\\})'), swapTabs, 'all');
        }

        return out
    }

    private createSnippet(out: string[]): string {
        let snippet: string = "";
        let closer: string = this.parser.getSettings()['commentCloser'];
        if (out) {
            if (this.config.get<string>('spacerBetweenSections') == "true") {
                let lastTag: string;
                for (let index: number = 0; index < out.length; index++) {
                    let res: string[] = XRegExp.match(out[index], XRegExp('^\\s*@([a-zA-Z]+)'));
                    if (res && (lastTag != res[1])) {
                        if (this.config.get<boolean>('functionDescription') || (!this.config.get<boolean>('functionDescription') && lastTag))
                            out.splice(index++, 0, "");
                        lastTag = res[1];
                    }
                }
            } else if (this.config.get<string>('spacerBetweenSections') == 'after_description' && this.config.get<boolean>('functionDescription')) {
                let lastLineIsTag: boolean = false;
                for (let index: number = 0; index < out.length; index++) {
                    let res: string[] = XRegExp.match(out[index], XRegExp('^\\s*@([a-zA-Z]+)'));
                    if (res) {
                        if (!lastLineIsTag)
                            out.splice(index++, 0, "");
                        lastLineIsTag = true;
                    }
                }
            }
            for (let index: number = 0; index < out.length; index++) {
                snippet += "\n " + this.prefix + (this.indentSpaces + ((out[index]) ? out[index] : ""));
            }
        } else {
            snippet += "\n " + this.prefix + this.indentSpaces + "${0:" + this.trailingString + '}';
        }
        snippet += "\n" + closer;
        return snippet;
    }

}