'use strict';

import * as vscode from 'vscode';
import DocBlockr from './docblockr';
import { LogLevel, ILogger, Logger } from './utils/logger';

export default class DocBlockrLoader {

    private documentListener: vscode.Disposable;
    private logger: ILogger;

    constructor() {
        this.logger = new Logger('docblockr');
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.loadConfiguration, this, subscriptions);
        vscode.commands.registerTextEditorCommand('docblockr.run', (new DocBlockr()).run, null);
        this.loadConfiguration();
    }

    public dispose(): void {
    }

    private loadConfiguration(): void {
        this.logger.log('Configuration changed');
        let section = vscode.workspace.getConfiguration('docblockr');
        if (section) {
            let logLevel: string = section.get<string>('logLevel', 'log');
            this.logger.setLogLevel(<LogLevel>LogLevel[logLevel]);
        }
    }
}
