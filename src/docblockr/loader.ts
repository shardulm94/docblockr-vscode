'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import DocBlockr from './docblockr';

export default class DocBlockrLoader {

    private documentListener: vscode.Disposable;
    private logger: ILogger;
    private docBlockr: DocBlockr;
    private config: Config;
    
    constructor() {
        this.logger = Logger.getInstance();
        this.config = Config.getInstance();
        this.docBlockr = new DocBlockr();
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.config.load, this, subscriptions);
        vscode.commands.registerTextEditorCommand('docblockr.runTab', this.docBlockr.runTab, this.docBlockr);
        this.logger.log("DocBlockr activated.");
    }

    public dispose(): void {
    }

    
}
