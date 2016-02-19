'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import * as util from './utils/common';
import * as parser from './parsers/helper';
import BaseParser from './parsers/base';

export default class DocBlockr {

    private logger: ILogger;
    private keyPressed: string;

    private settings: vscode.TextEditorOptions;
    private trailingRgn: vscode.Range;
    private trailingString: string;
    private indentSpaces: string;
    private prefix: string;
    private parser: BaseParser;

    private SETTING_INDENTATION_SPACES: number = 1;

    constructor() {
        this.logger = new Logger('docblockr');
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
    }

    public runTab(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void {
        this.keyPressed = "\t";
        this.run(editor, editorEdit);
    }

    private initialize(editor: vscode.TextEditor, inline: boolean = false) {
        let point: vscode.Position = editor.selection.end;
        this.settings = editor.options;

        this.trailingRgn = new vscode.Range(point, editor.document.lineAt(point).range.end);
        this.trailingString = editor.document.getText(this.trailingRgn).trim();
        this.trailingString = util.escape(this.trailingString.replace(new RegExp('\\s*\\*\\/\\s*$'), ''));

        this.indentSpaces = " ".repeat(Math.max(0, this.SETTING_INDENTATION_SPACES));
        this.prefix = "*";
        
        // TODO: Align Tags
       
       this.parser = parser.getParser(editor.document.languageId);
       
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