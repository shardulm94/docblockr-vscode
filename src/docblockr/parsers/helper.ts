'use strict';

import BaseParser from './base';
import JavascriptParser from './javascript';

export function getParser(languageId:string): BaseParser {
    return new JavascriptParser();
}