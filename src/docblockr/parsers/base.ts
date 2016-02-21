'use strict';

import { Config } from '../config';
import * as util from '../utils/common';
let XRegExp = require('xregexp');

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

    public isExistingComment(line: string): boolean {
        return XRegExp.test(line, XRegExp('^\\s*\\*'));
    }

    public setInline(inline: boolean): void {
        this.inline = inline;
    }

    public getInline(): boolean {
        return this.inline;
    }

    public getSettings(): {} {
        return this.settings;
    }

    public setNameOverride(name: string): void {
        //overrides the description of the function - used instead of parsed description
        this.nameOverride = name;
    }

    public getNameOverride(): string {
        return this.nameOverride;
    }

    public parse(line: string): string[] {
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

            out.push("${1:[" + util.escape(name) + " description]}");
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
            args = XRegExp.replace(args, XRegExp("/\\*.*?\\*/"), "");
            this.parseArgs(args).forEach(arg => {
                let typeInfo: string = this.getTypeInfo(arg.argType, arg.argName);

                let formatStr: string = "@param "
                    + typeInfo
                    + (this.config.get<boolean>('paramName') ? util.escape(arg.argName) : "")
                    + (this.config.get<boolean>("paramDescription") ? " ${1:[description]}" : "");
                out.push(formatStr);
            }, this);
        }
        
        // return value type might be already available in some languages but
        // even then ask language specific parser if it wants it listed
        let retType: string = this.getFunctionReturnType(name, retval);
        if (retType !== undefined) {
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
        if (XRegExp.test(name, XRegExp("[A-Z]"), 0, true))
            // no return, but should add a class
            return undefined;

        if (XRegExp.test(name, XRegExp("[$_]?(?:set|add)($|[A-Z_])"), 0, true))
            // setter/mutator, no return
            return undefined;

        if (XRegExp.test(name, XRegExp("[$_]?(?:is|has)($|[A-Z_])"), 0, true))
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
        }, this);

        return util.flatten<IParseArg>(out);
    }

    protected getArgInfo(arg: string): IParseArg[] {
        // Returns an array of IParseArg, one for each argument derived from the arg param.
        return [{ argType: this.getArgType(arg), argName: this.getArgName(arg) }];
    }

    protected getArgType(arg: string): string {
        return null;
    }

    protected getArgName(arg: string): string {
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
            if (rule.type)
                return ((this.settings[rule.type]) ? this.settings[rule.type] : rule.type);
        }

        if (XRegExp.test(name, XRegExp("(?:is|has)[A-Z_]"), 0, true))
            return this.settings['bool'];

        if (XRegExp.test(name, XRegExp("^(?:cb|callback|done|next|fn)$"), 0, true))
            return this.settings['function'];

        return null;
    }

    protected getMatchingNotations(name: string): INotationMap[] {
        return (this.getNotationMapFromConfig() || [])
            .filter(function(rule: INotationMap): boolean {
                if (rule.prefix) {
                    let regex: string = XRegExp.escape(rule.prefix);
                    if (XRegExp.test(rule.prefix, XRegExp(".*[a-z]"), 0, true))
                        regex += "(?:[A-Z_]|$)";
                    return XRegExp.test(rule.prefix, XRegExp(regex), 0, true);

                } else if (rule.regex) {
                    return XRegExp.test(name, XRegExp(rule.regex));
                }
            }, this);
    }

    private getNotationMapFromConfig(): INotationMap[] {
        // let notationMap:Object[] =  (this.config.get<Object>("notationMap"))["notations"];
        // let out:INotationMap[] = [];
        // notationMap.forEach(notation => {
        //     out.push({prefix: notation.prefix, regex: notation.regex, type: notation.type, tags: notation.tags});
        // });
        // return out;
        let notationMap: INotationMap[] = (this.config.get<Object>("notationMap"))["notations"];
        return notationMap;
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
            line = XRegExp.replace(line, XRegExp("//.*"), "");
            line = XRegExp.replace(line, XRegExp("/\\*.*\\*/"), "");

            let searchForBrackets: string = line;
            
            // on the first line, only start looking from *after* the actual function starts. This is
            // needed for cases like this:
            // (function (foo, bar) { ... })
            if (definition == "") {
                let opener = ((this.settings['fnOpener']) ? XRegExp.exec(line, XRegExp(this.settings['fnOpener'])) : null);
                if (opener)
                    // ignore everything before the function opener
                    searchForBrackets = line.substring(opener.index);
            }

            openBrackets = XRegExp.match(searchForBrackets, XRegExp("[()]", "g")).reduce(countBrackets, openBrackets);

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