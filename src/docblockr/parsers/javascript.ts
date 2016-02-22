'use strict';

import { BaseParser, IParseFunction, IParseVar, IParseArg, INotationMap } from './base';
import * as util from '../utils/common';
import XRegExp = require('xregexp');

export default class JavascriptParser extends BaseParser {

    private identifier: string;

    constructor() {
        super();
        this.setupSettings();
    }

    protected setupSettings() {
        this.identifier = '[a-zA-Z_$][a-zA-Z_$0-9]*'
        this.settings = {
            // curly brackets around the type information
            "curlyTypes": true,
            'typeInfo': true,
            "typeTag": this.config.get<string>('overrideJsVar') || "type",
            // technically, they can contain all sorts of unicode, but w/e
            "varIdentifier": this.identifier,
            "fnIdentifier": this.identifier,
            "fnOpener": '(?:'
            + 'function[\\s*]*(?:' + this.identifier + ')?\\s*\\('
            + '|'
            + '(?:' + this.identifier + '|\\(.*\\)\\s*=>)'
            + '|'
            + '(?:' + this.identifier + '\\s*\\(.*\\)\\s*\\{)'
            + ')',
            "commentCloser": " */",
            "bool": "Boolean",
            "function": "Function"
        }
    }

    protected parseFunction(line: string): IParseFunction {
        let res = XRegExp.exec(line, XRegExp(
            // Normal functions...
            //   fnName = function,  fnName : function
            '(?:(?<name1>' + this.settings['varIdentifier'] + ')\\s*[:=]\\s*)?'
            + 'function'
            // function fnName, function* fnName
            + '(?<generator>[\\s*]+)?(?<name2>' + this.settings['fnIdentifier'] + ')?'
            // (arg1, arg2)
            + '\\s*\\(\\s*(?<args>.*)\\)'
        )) || XRegExp.exec(line, XRegExp(
            // ES6 arrow functions
            // () => y,  x => y,  (x, y) => y,  (x = 4) => y
            '(?:(?<args>' + this.settings['varIdentifier'] + ')|\\(\\s*(?<args2>.*)\\))\\s*=>'
        )) || XRegExp.exec(line, XRegExp(
            // ES6 method initializer shorthand
            // var person = { getName() { return this.name; } }
            '(?<name1>' + this.settings['varIdentifier'] + ')\\s*\\((?<args>.*)\\)\\s*\\{'
        ));
        if (!res)
            return null;
        
        // grab the name out of "name1 = function name2(foo)" preferring name1
        let generatorSymbol: string = (((res.generator || '').indexOf('*') > -1) ? '*' : '');
        let name: string = generatorSymbol + (res.name1 || res.name2 || '');
        let args: string = res.args || res.args2 || '';

        return { name: name, args: args }
    }

    protected parseVar(line: string): IParseVar {
        let res = XRegExp.exec(line, XRegExp(
            //    var foo = blah,
            //        foo = blah;
            //    baz.foo = blah;
            //    baz = {
            //         foo : blah
            //    }
            '(?<name>' + this.settings['varIdentifier'] + ')\\s*[=:]\\s*(?<val>.*?)(?:[;,]|$)'
        ));
        if (!res)
            return null;

        return { name: res.name, val: res.val.trim() };
    }
    
    protected getArgInfo(arg:string) : IParseArg[]{
        let subItems:string[];
        let prefix:string = "";  
        if(XRegExp.test(arg, XRegExp('^\{.*\}$'))){
            subItems = util.splitByCommas(arg.substring(1, arg.length - 1 ));
            prefix = 'options.';
        }else{
            subItems = [arg];
        }
        
        let out:IParseArg[] = [];
        subItems.forEach(subItem => {
            out.push({ argType: this.getArgType(subItem), argName: prefix + this.getArgName(subItem) });
        },this);
        return out;
    }
    
    protected getArgType(arg:string):string{
        let parts:string[];
        parts = XRegExp.split(arg, XRegExp('\\s*=\\s*'), 2);
        // rest parameters
        if(parts[0].indexOf('...') == 0)
            return '...[type]';
        else if (parts.length > 1)
            return this.guessTypeFromValue(parts[1]);
    }
    
    protected getArgName(arg:string):string{
        let namePart:string = XRegExp.split(arg, XRegExp('\\s*=\\s*'), 1)[0];
        
        // check for rest parameters, eg: function (foo, ...rest) {}
        if (namePart.indexOf('...') == 0)
            return namePart.substring(3);
        return namePart;
    }
    
    protected getFunctionReturnType(name:string, retval:string):string {
        if (name && name[0] == '*')
            return undefined;
        return super.getFunctionReturnType(name, retval);
    }
    
    protected getMatchingNotations(name:string):INotationMap[]{
        let out:INotationMap[] = super.getMatchingNotations(name);
        if (name && name[0] == '*'){
            // if '@returns' is preferred, then also use '@yields'. Otherwise, '@return' and '@yield'
            let yieldTag:string = '@yield' + ((this.config.get<string>('returnTag').slice(-1) == 's') ? 's' : '');
            let description:string = ((this.config.get<boolean>('returnDescription')) ? ' ${1:[description]}'  : '');
            out.push({ tags: [
                yieldTag 
                + ' {${1:[type]}}' 
                // the extra space here is so that the description will align with the param description
                + (((this.config.get<string>("alignTags") == "deep") && !this.config.get<boolean>("perSectionIndent")) ? " " : "")
                + description
            ]});
        }
        return out;
    }
    
    protected guessTypeFromValue(val:string):string{
        let lowerPrimitives:boolean = this.config.get<boolean>('lowerCasePrimitives') || false;
        let shortPrimitives:boolean = this.config.get<boolean>('shortPrimitives') || false;
        
        if (util.isNumeric(val))
            return ((lowerPrimitives)?"number" : "Number");
        if (val[0] == '"' || val[0] == "'")
            return ((lowerPrimitives)?"string": "String");
        if (val[0] == '[')
            return "Array";
        if (val[0] == '{')
            return "Object";
        if (val == 'true' || val == 'false'){
            let returnVal:string = ((shortPrimitives)?'Bool': 'Boolean');
            return ((lowerPrimitives)? returnVal.toLowerCase() : returnVal);
        }
        if (XRegExp.test(val, XRegExp('RegExp\\b|\\/[^\\/]'), 0, true)) // TODO : check if this works
            return 'RegExp';
        if (val.indexOf('=>') > -1)
            return ((lowerPrimitives)?'function' : 'Function');
        if (val.substring(0,4) == 'new '){
            let res = XRegExp.exec(val, XRegExp('new (' + this.settings['fnIdentifier'] + ')'));
            return res && res[1] || null;
        }
        return null;
    }
}