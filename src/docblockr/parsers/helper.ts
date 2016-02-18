'use strict';

import CommonParser from './common';
import JavascriptParser from './javascript';

export function getParser(languageId:string): CommonParser {
    return new JavascriptParser();
}