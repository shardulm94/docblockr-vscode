import * as vscode from 'vscode';
import DocBlockr from './docblockr';
import XRegExp = require('xregexp');

enum CommandKey {
    selectionEmpty,
    precedingText,
    followingText
}

enum CommandOperator {
    equal,
    regexContains
}

interface ICommandRule {
    key: CommandKey,
    operator: CommandOperator,
    operand: string,
}

interface ICommand {
    command: (editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit, args: {}) => void,
    args?: {},
    rules?: ICommandRule[]
}

interface IKeyBinding {
    key: string,
    commands: ICommand[]
}

export default class CommandManager {

    private docblockr: DocBlockr;
    private keyBindings: IKeyBinding[];

    constructor() {
        this.docblockr = new DocBlockr();
        this.defineKeyBindings();
    }

    private getCommand(key: string, editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit): void { //TODO: Add logging
        let isAnyKeyBindingExecuted: boolean = false;
        this.keyBindings.forEach(function(keyBinding: IKeyBinding) {
            if (keyBinding.key == key) {
                keyBinding.commands.forEach(function(command: ICommand) {
                    let isToBeExecuted: boolean = true;
                    isToBeExecuted = command.rules.every(function(rule: ICommandRule) {
                        return this.checkRule(editor, rule);
                    }, this);

                    if (isToBeExecuted) {
                        isAnyKeyBindingExecuted = true;
                        var boundCommand = command.command.bind(this.docblockr, editor, editorEdit, command.args);
                        boundCommand();
                    }
                }, this);
            }
        }, this);
        if (!isAnyKeyBindingExecuted)
            editorEdit.insert(editor.selection.active, this.docblockr.keyPressed);
    }

    private checkRule(editor: vscode.TextEditor, rule: ICommandRule): boolean {
        let active: vscode.Position = editor.selection.active,
            currLine: vscode.TextLine = editor.document.lineAt(active),
            precedingText: string = editor.document.getText(new vscode.Range(currLine.range.start, active)),
            followingText: string = editor.document.getText(new vscode.Range(active, currLine.range.end));
            
        switch (rule.key) {
            case CommandKey.precedingText:
                if (rule.operator == CommandOperator.regexContains) {
                    return XRegExp.test(precedingText, XRegExp(rule.operand));
                }
                break;
            case CommandKey.followingText:
                if (rule.operator == CommandOperator.regexContains) {
                    return XRegExp.test(followingText, XRegExp(rule.operand));
                }
                break;

            default:
                return false;
        }
        return false;
    }

    public tab(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit) {
        this.docblockr.keyPressed = "\t";
        this.getCommand("tab", editor, editorEdit);
    }

    public enter(editor: vscode.TextEditor, editorEdit: vscode.TextEditorEdit) {
        this.docblockr.keyPressed = "\n";
        this.getCommand("enter", editor, editorEdit);
    }

    private defineKeyBindings(): void {

        this.keyBindings = [
            {
                key: "tab",
                commands: [{
                    command: this.docblockr.run,
                    rules: [{
                        key: CommandKey.precedingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\s*(\\/\\*|###)[*!]\\s*$"
                    }]
                },{
                    command: this.docblockr.insertSnippet,
                    args: {contents: "\n$0\n */"},
                    rules: [{
                        key: CommandKey.precedingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\s*\\/\\*$"
                    }],
                }]
            },
            {
                key: "enter",
                commands: [{
                    command: this.docblockr.run,
                    rules: [{
                        key: CommandKey.precedingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\s*(\\/\\*|###)[*!]\\s*$"
                    }]
                },{
                    command: this.docblockr.insertSnippet,
                    args: {contents: "\n$0\n */"},
                    rules: [{
                        key: CommandKey.precedingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\s*\\/\\*$"
                    }],
                },{
                    command: this.docblockr.insertSnippet,
                    args: {contents: "\n$0\n "},
                    rules: [{
                        key: CommandKey.precedingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\s*\\/\\*$"
                    },{
                        key: CommandKey.followingText,
                        operator: CommandOperator.regexContains,
                        operand: "^\\*\\/\\s*$"
                    }],
                }]
            }
        ];
    }
}
