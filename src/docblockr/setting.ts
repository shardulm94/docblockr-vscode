'use strict';

import * as vscode from 'vscode';

export default class Setting {

    private static _instance: Setting = new Setting();
    private _config: vscode.WorkspaceConfiguration;

    constructor() {
        if (!Setting._instance) {
            Setting._instance = this;
            this.load();
        }
    }

    public static getInstance(): Setting {
        return Setting._instance;
    }

    public load(): void {
        this._config = vscode.workspace.getConfiguration('docblockr');
    }

    public get<T>(key: string): T {
        return this._config.get<T>(key);
    }
}