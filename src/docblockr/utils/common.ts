'use strict';

export function escape(str:string) {
    return str.replace('$', '\$').replace('{', '\{').replace('}', '\}');
}