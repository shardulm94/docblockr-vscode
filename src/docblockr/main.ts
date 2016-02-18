'use strict';

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';

export default class DocBlockr {

    private documentListener: vscode.Disposable;
    private logger: ILogger;

    constructor() {
        this.logger = new Logger('docblockr-vscode');
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfiguration, this, subscriptions);
        vscode.commands.registerTextEditorCommand('docblockr-vscode.jsdocs', this.runDocBlockr, null);
        this.loadConfiguration();
    }

    public dispose(): void {
    }

    private loadConfiguration(): void {
        this.logger.log('Configuration changed');
        let section = vscode.workspace.getConfiguration('docblockr-vscode');
        if (section) {
            let logLevel: string = section.get<string>('logLevel', 'log');
            this.logger.setLogLevel(<LogLevel>LogLevel[logLevel]);
        }
    }
    
    private runDocBlockr(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit) {
        let currLine = editor.selection.active.line,
            currChar = editor.selection.active.character,
            precedingText = editor.document.getText(new vscode.Range(currLine, 0, currLine, currChar));
        
        
    }

}
