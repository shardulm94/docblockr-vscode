'use strict';

import { Config } from '../config';
import * as util from '../utils/common';

export interface IParseFunction {
    name: string,
    args: string,
    retval?: string,
    options?: any
}

export interface IParseVar {
    name: string,
    val: string,
    valType?: string,
}

export interface IParseArg {
    argType: string,
    argName: string
}

export interface INotationMap {
    prefix?: string,
    regex?: string,
    type?: string,
    tags: string[]
}

export abstract class BaseParser {

    protected config: Config;
    protected nameOverride: string;
    private inline: boolean;
    protected settings: {};

    constructor() {
        this.config = Config.getInstance();
        this.nameOverride = null;
    }

    private matchRegex(regex: RegExp, str: string): RegExpExecArray {
        return (new RegExp("^" + regex.source)).exec(str);
    }

    private isExistingComment(line: string): number {
        return line.search(new RegExp('^\\s*\\*'));
    }

    public setInline(inline: boolean): void {
        this.inline = inline;
    }

    public getInline(): boolean {
        return this.inline;
    }

    public setNameOverride(name: string): void {
        //overrides the description of the function - used instead of parsed description
        this.nameOverride = name;
    }

    public getNameOverride(): string {
        return this.nameOverride;
    }

    private parse(line: string): string[] {
        if (this.config.get<boolean>('simpleMode'))
            return;

        try {
            let outFunc: IParseFunction = this.parseFunction(line);
            if (outFunc)
                return this.formatFunction(outFunc.name, outFunc.args, outFunc.retval, outFunc.retval);

            let outVar: IParseVar = this.parseVar(line);
            if (outVar)
                return this.formatVar(outVar.name, outVar.val, outVar.valType);
        } catch (exception) {
            // TODO: show exception if dev\debug mode
        }
    }

    private formatVar(name: string, val: string, valType: string = null): string[] {
        let out: string[] = []
        if (!valType) {
            if (!val || val == '') //quick short circuit
                valType = "[type]";
            else
                valType = this.guessTypeFromValue(val) || this.guessTypeFromName(name) || "[type]";
        }
        if (this.inline) {
            out.push("@" + this.settings['typeTag'] + " "
                + ((this.settings['curlyTypes']) ? "{" : "")
                + "${1:" + valType + "}"
                + ((this.settings['curlyTypes']) ? "}" : "") + " "
                + "${1:[description]}");
        }
        else {

            out.push("${1:[" + util.escape(name) + "description]}");
            out.push("@" + this.settings['typeTag'] + " "
                + ((this.settings['curlyTypes']) ? "{" : "")
                + "${1:" + valType + "}"
                + ((this.settings['curlyTypes']) ? "}" : ""));
        }

        return out;
    }

    private getTypeInfo(argType: string, argName: string): string {
        let typeInfo: string = '';
        if (this.settings['typeInfo']) {
            typeInfo = ((this.settings['curlyTypes']) ? "{" : "")
                + "${1:" + util.escape(argType || this.guessTypeFromName(argName) || "[type]")
                + "}" + ((this.settings['curlyTypes']) ? "}" : "") + " ";
        }
        return typeInfo;
    }

    private formatFunction(name: string, args: string, retval: string, options: any = {}): string[] { // TODO: fix options type (any??)
        let out: string[] = [];
        if (options.as_setter) {
            out.push("@private");
            return out;
        }

        let extraTagAfter: boolean = this.config.get<boolean>("extraTagsGoAfter") || false;

        let description: string = this.getNameOverride() || ("[" + util.escape(name) + (name ? " " : "") + "description]");
        if (this.config.get<boolean>("functionDescription"))
            out.push("${1:" + description + "}");

        if (this.config.get<boolean>("autoaddMethodTag"))
            out.push("@method " + util.escape(name));
        if (!extraTagAfter)
            this.addExtraTags(out);
            
        // if there are arguments, add a @param for each
        if (args) {
            // remove comments inside the argument list.
            args = args.replace(new RegExp("/\*.*?\*/"), "");
            this.parseArgs(args).forEach(arg => {
                let typeInfo: string = this.getTypeInfo(arg.argName, arg.argType);

                let formatStr: string = "@param "
                    + typeInfo
                    + (this.config.get<boolean>('paramName') ? util.escape(arg.argName) : "")
                    + (this.config.get<boolean>("paramDescription") ? " ${1:[description]}" : "");
                out.push(formatStr);
            });
        }
        
        // return value type might be already available in some languages but
        // even then ask language specific parser if it wants it listed
        let retType: string = this.getFunctionReturnType(name, retval);
        if (retType === undefined) {
            let typeInfo: string = "";
            if (this.settings['typeInfo']) {
                typeInfo = " "
                    + ((this.settings['curlyTypes']) ? "{" : "")
                    + "${1:" + (retType || "[type]") + "}"
                    + ((this.settings['curlyTypes']) ? "}" : "");
            }

            let formatArgs: string[] = [
                this.config.get<string>("returnTag") || "@return",
                typeInfo
            ];

            let formatStr: string = formatArgs[0] + formatArgs[1];
            if (this.config.get<boolean>("returnDescription")) {
                formatStr = formatStr + " "
                    // the extra space here is so that the description will align with the param description
                    + ((args && (this.config.get<string>("alignTags") == "deep") && !this.config.get<boolean>("perSectionIndent")) ? " " : "")
                    + "${1:[description]}";
            }
            out.push(formatStr);
        }

        this.getMatchingNotations(name).forEach(notation => {
            if (notation.tags)
                out = out.concat(notation.tags);
        });

        if (extraTagAfter)
            this.addExtraTags(out);

        return out;

    }

    protected getFunctionReturnType(name: string, retval: string): string {
        // returns undefined for no return type. null meaning unknown, or a string
        if ((new RegExp("[A-Z]", "i")).test(name))
            // no return, but should add a class
            return undefined;

        if ((new RegExp("[$_]?(?:set|add)($|[A-Z_])", "i")).test(name))
            // setter/mutator, no return
            return undefined;

        if ((new RegExp("[$_]?(?:is|has)($|[A-Z_])", "i")).test(name))
            // functions starting with 'is' or 'has'
            return this.settings['bool'];

        return this.guessTypeFromName(name) || null;
    }

    private parseArgs(args: string): IParseArg[] {
        // a list of tuples, the first being the best guess at the type, the second being the name
        let blocks: string[] = util.splitByCommas(args);
        let out: IParseArg[][] = [];
        blocks.forEach(arg => {
            out.push(this.getArgInfo(arg));
        });

        return util.flatten<IParseArg>(out);
    }

    protected getArgInfo(arg: string): IParseArg[] {
        // Returns an array of IParseArg, one for each argument derived from the arg param.
        return [{ argType: this.getArgType(arg), argName: this.getArgName(arg) }];
    }

    private getArgType(arg: string): string {
        return null;
    }

    private getArgName(arg: string): string {
        return arg;
    }

    private addExtraTags(out: string[]): void {
        let extraTags: string[] = this.config.get<string[]>("extraTags") || [];
        if (extraTags.length > 0)
            out = out.concat(extraTags);
    }

    private guessTypeFromName(name: string): string {
        let matches: INotationMap[] = this.getMatchingNotations(name);
        if (matches.length > 0) {
            let rule: INotationMap = matches[0];
            if(rule.type)
                return (this.settings[rule.type]) ? this.settings[rule.type] : rule.type;
        }

        if ((new RegExp("(?:is|has)[A-Z_]", "i")).test(name))
            return this.settings['bool'];

        if ((new RegExp("^(?:cb|callback|done|next|fn)$", "i")).test(name))
            return this.settings['function'];

        return null;
    }

    protected getMatchingNotations(name: string): INotationMap[] {
        return (this.config.get<INotationMap[]>("notationMap") || [])
            .filter(function(rule: INotationMap): boolean {
                if (rule.prefix) {
                    let regex: string = util.escapeRegex(rule.prefix);
                    if (this.matchRegex(new RegExp(".*[a-z]"), rule.prefix))
                        regex += "(?:[A-Z_]|$)";
                    return (this.matchRegex(new RegExp(regex), name)) ? true : false;

                } else if (rule.regex) {
                    return (new RegExp(rule.regex, "i")).test(name);
                }
            }, this);
    }

    public getDefinition(lines: string[]): string {
        // get a relevant definition starting at the given point
        // returns string
        let openBrackets: number = 0;
        let definition: string = '';
        
        // count the number of open parentheses
        function countBrackets(total: number, bracket: string): number {
            return total + ((bracket == "(") ? 1 : -1);
        }

        for (let i: number = 0; i < lines.length; i++) {
            let line: string = lines[i];
            
            // strip comments
            line = line.replace(new RegExp("//.*"), "");
            line = line.replace(new RegExp("/\\*.*\\*/"), "");

            let searchForBrackets: string = line;
            
            // on the first line, only start looking from *after* the actual function starts. This is
            // needed for cases like this:
            // (function (foo, bar) { ... })
            if (definition == "") {
                let opener: RegExpExecArray = (this.settings['fnOpener']) ? (new RegExp(this.settings['fnOpener'])).exec(line) : null;
                if (opener)
                    // ignore everything before the function opener
                    searchForBrackets = line.substring(opener.index);
            }

            openBrackets = searchForBrackets.match(new RegExp("[()]", "g")).reduce(countBrackets, openBrackets);

            definition += line;
            if (openBrackets == 0)
                break;
        }
        return definition;
    }

    protected abstract parseFunction(line: string): IParseFunction;
    protected abstract parseVar(line: string): IParseVar;
    protected abstract guessTypeFromValue(val: string): string;
    protected abstract setupSettings(): void;

}