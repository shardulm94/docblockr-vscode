'use strict';

import { BaseParser } from './base';

export default class JavascriptParser extends BaseParser {
    
    private identifier:string;
    
    constructor(){
        super();
        this.setupSettings();
    }
    
    protected setupSettings(){
        this.identifier = '[a-zA-Z_$][a-zA-Z_$0-9]*'
        this.settings = {
            // curly brackets around the type information
            "curlyTypes": true,
            'typeInfo': true,
            "typeTag": this.config.get<string>('overrideJsVar') || "type",
            // technically, they can contain all sorts of unicode, but w/e
            "varIdentifier": this.identifier,
            "fnIdentifier":  this.identifier,
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

}