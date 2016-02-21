'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import * as util from './utils/common';
import * as parser from './parsers/helper';
import { BaseParser } from './parsers/base';

export default class DocBlockr {

    private logger: ILogger;
    private config: Config;
    private keyPressed: string;

    private trailingRgn: vscode.Range;
    private trailingString: string;
    private indentSpaces: string;
    private prefix: string;
    private parser: BaseParser;
    private line: string;

    constructor() {
        this.logger = Logger.getInstance();
        this.config = Config.getInstance();
    }

    public run(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, inline: boolean = false): void {
        let currLine: number = editor.selection.active.line,
            currChar: number = editor.selection.active.character,
            precedingText: string = editor.document.getText(new vscode.Range(currLine, 0, currLine, currChar));

        if (!this.validRunRegex(precedingText)) {
            editorEdit.insert(editor.selection.active, this.keyPressed);
            return;
        }

        this.initialize(editor, inline);
        
        if(this.parser.isExistingComment(this.line)){
            editorEdit.insert(editor.selection.active, "\n *" + this.indentSpaces);
            return
        }

        // erase characters in the view (will be added to the output later)
        editorEdit.delete(this.trailingRgn);

        // match against a function declaration.
        let out:string[] = this.parser.parse(this.line)

        let snippet:string = this.generateSnippet(out, inline);

        editorEdit.insert(editor.selection.active, snippet);

    }

    public runTab(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.keyPressed = "\t";
        this.run(editor, editorEdit);
    }

    private initialize(editor: vscode.TextEditor, inline: boolean = false): void {
        let point: vscode.Position = editor.selection.end;

        this.trailingRgn = new vscode.Range(point, editor.document.lineAt(point).range.end);
        this.trailingString = editor.document.getText(this.trailingRgn).trim();
        this.trailingString = util.escape(this.trailingString.replace(new RegExp('\\s*\\*\\/\\s*$'), ''));

        this.indentSpaces = " ".repeat(Math.max(0, this.config.get<number>('indentationSpaces')));
        this.prefix = "*";
        
        // TODO: Align Tags
       
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
    
    private generateSnippet(out:string[], inline:boolean):string{
        return out.join("\n");
    }

    private validRunRegex(precedingText: string): boolean {
        let validPrecedingRegexes: RegExp[] = [
            new RegExp("^\\s*(\\/\\*|###)[*!]\\s*$")
        ];
        return this.validRegex(precedingText, validPrecedingRegexes);
    }

    private validRegex(str: string, regexes: RegExp[]): boolean {
        for (var i = 0; i < regexes.length; i++) {
            if (regexes[i].test(str)) return true;
        }
        return false;
    }

}