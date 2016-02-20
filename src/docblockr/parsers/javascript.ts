'use strict';

import { BaseParser } from './base';

export default class JavascriptParser extends BaseParser {
    
    constructor(){
        super();
        this.setupSettings();
    }
}