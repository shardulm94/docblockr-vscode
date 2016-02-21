'use strict';

export function escape(str: string) {
    return str.replace('$', '\$').replace('{', '\{').replace('}', '\}');
}

export function isNumeric(val:any):boolean {
    return !isNaN(parseFloat(val)) && isFinite(val);
}

export function splitByCommas(str: string): string[] {
    // Split a string by unenclosed commas: that is, commas which are not inside of quotes or brackets.
    // splitByCommas('foo, bar(baz, quux), fwip = "hey, hi"')
    //  ==> ['foo', 'bar(baz, quux)', 'fwip = "hey, hi"']
    let out: string[] = [];

    if (!str)
        return out;
    
    // the current token
    let current: string = "";

    // characters which open a section inside which commas are not separators between different arguments
    let openQuotes: string = '"\'<({';
    // characters which close the section. The position of the character here should match the opening
    // indicator in `openQuotes`
    let closeQuotes: string = '"\'>)}';

    let matchingQuote: string = "";
    let insideQuotes: boolean = false;
    let nextIsLiteral: boolean = false;

    for (let i: number = 0; i < str.length; i++) {
        let char: string = str[i];
        if (nextIsLiteral) {  // previous char was a \
            current += char;
            nextIsLiteral = false;
        } else if (insideQuotes) {
            if (char == '\\') {
                nextIsLiteral = true;
            } else {
                current += char;
                if (char == matchingQuote)
                    insideQuotes = false;
            }
        } else {
            if (char == ',') {
                out.push(current.trim());
                current = '';
            } else {
                current += char;
                let quoteIndex:number = openQuotes.indexOf(char);
                if (quoteIndex > -1) {
                    matchingQuote = closeQuotes[quoteIndex];
                    insideQuotes = true
                }
            }
        }
    }
    out.push(current.trim())
    return out
} 

export function flatten<T>(arr:T[][]) : T[]{
    return arr.reduce(function(a, b) {
        return a.concat(b);
    }, []);
}
    

    
