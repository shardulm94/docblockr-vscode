'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';
import { Config } from './config';
import CommandManager from './command';

export default class DocBlockrLoader {

    private documentListener: vscode.Disposable;
    private logger: ILogger;
    private config: Config;
    private commandManager: CommandManager;

    constructor() {
        this.logger = Logger.getInstance();
        this.logger.setPrefix('DocBlockr');
        this.config = Config.getInstance();
        this.commandManager = new CommandManager();
    }

    public activate(subscriptions: vscode.Disposable[]): void {
        subscriptions.push(this);
        vscode.workspace.onDidChangeConfiguration(this.config.load, this, subscriptions);
        vscode.commands.registerTextEditorCommand('docblockr.tab', this.commandManager.tab, this.commandManager);
        vscode.commands.registerTextEditorCommand('docblockr.enter', this.commandManager.enter, this.commandManager);
        this.logger.log("DocBlockr activated.");
    }

    public dispose(): void {
    }


}
