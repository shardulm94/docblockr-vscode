'use strict';

import * as vscode from 'vscode';
import { LogLevel, ILogger, Logger } from './utils/logger';

export class Config {

    private static instance: Config = new Config();
    private config: vscode.WorkspaceConfiguration;
    private logger: ILogger;

    constructor() {
        if (!Config.instance) {
            Config.instance = this;
            this.logger = Logger.getInstance();
            this.load();
        }
    }

    public static getInstance(): Config {
        return Config.instance;
    }

    public load(): void {
        this.config = vscode.workspace.getConfiguration('docblockr');
        this.logger.setLogLevel(this.get<LogLevel>('logLevel'));
        this.logger.log('Configuration laoded');
    }

    public get<T>(key: string): T {
        return this.config.get<T>(key);
    }
}