'use strict';

import { BaseParser, IParseFunction, IParseVar } from './base';
let XRegExp = require('xregexp');

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
        let generatorSymbol: string = ((res.generator || '').indexOf('*') > -1) ? '*' : '';
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


}