'use strict';

export function escape(str:string) {
    return str.replace('$', '\$').replace('{', '\{').replace('}', '\}');
}

export function escapeRegex(str:string) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}