'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';

export default class DocBlockr {

    private logger: ILogger;

    constructor() {
        this.logger = new Logger('docblockr');
    }

    public run(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, inline: boolean = false): void {
        let currLine: number = editor.selection.active.line,
            currChar: number = editor.selection.active.character,
            precedingText: string = editor.document.getText(new vscode.Range(currLine, 0, currLine, currChar));

        if (!this.validRunRegex(precedingText)) return;
        this.initialize(editor, inline);
    }

    private initialize(editor: vscode.TextEditor, inline: boolean = false) {

    }



    private validRunRegex(precedingText: string): boolean {
        let validPrecedingRegexes: RegExp[] = [
            new RegExp("^\\s*(\\/\\*|###)[*!]\\s*$")
        ];
        return this.validRegex(precedingText, validPrecedingRegexes);
    }

    private validRegex(str: string, regexes: RegExp[]): boolean {
        regexes.forEach(regex => {
            if (regex.test(str)) return true;
        });
        return false;
    }

}