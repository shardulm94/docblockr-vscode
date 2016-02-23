import * as vscode from 'vscode';
import DocBlockr from './docblockr';
import XRegExp = require('xregexp');

enum CommandKey {
    selectionEmpty,
    precedingText
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
        let currLine: number = editor.selection.active.line,
            currChar: number = editor.selection.active.character,
            precedingText: string = editor.document.getText(new vscode.Range(currLine, 0, currLine, currChar));
        switch (rule.key) {
            case CommandKey.precedingText:
                if (rule.operator == CommandOperator.regexContains) {
                    return XRegExp.test(precedingText, XRegExp(rule.operand));
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
                }]
            }
        ];
    }
}
