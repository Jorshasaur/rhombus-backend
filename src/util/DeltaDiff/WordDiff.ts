import { Diff } from 'diff'
import { START_RHOMBUS_EMBED_TOKEN, END_RHOMBUS_EMBED_TOKEN } from './'

// Ranges and exceptions:
// Latin-1 Supplement, 0080–00FF
//  - U+00D7  × Multiplication sign
//  - U+00F7  ÷ Division sign
// Latin Extended-A, 0100–017F
// Latin Extended-B, 0180–024F
// IPA Extensions, 0250–02AF
// Spacing Modifier Letters, 02B0–02FF
//  - U+02C7  ˇ &#711;  Caron
//  - U+02D8  ˘ &#728;  Breve
//  - U+02D9  ˙ &#729;  Dot Above
//  - U+02DA  ˚ &#730;  Ring Above
//  - U+02DB  ˛ &#731;  Ogonek
//  - U+02DC  ˜ &#732;  Small Tilde
//  - U+02DD  ˝ &#733;  Double Acute Accent
// Latin Extended Additional, 1E00–1EFF
const EXTENDED_WORD_CHARS = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/

const TOKENIZE_REGEX = new RegExp(
    `(${START_RHOMBUS_EMBED_TOKEN}|${END_RHOMBUS_EMBED_TOKEN}|\\s+|\\b)`
)

// Based diffWordsWithSpace from jsdiff library
const wordDiff = new Diff() as any

wordDiff.equals = function(left: string, right: string) {
    return left === right
}

wordDiff.tokenize = function tokenize(value: string) {
    const tokens = value.split(TOKENIZE_REGEX)

    // Join the boundary splits that we do not consider to be boundaries. This is primarily the extended Latin character set.
    for (let i = 0; i < tokens.length - 1; i++) {
        if (
            !tokens[i + 1] &&
            tokens[i + 2] &&
            EXTENDED_WORD_CHARS.test(tokens[i]) &&
            EXTENDED_WORD_CHARS.test(tokens[i + 2])
        ) {
            // If we have an empty string in the next field and we have only word chars before and after, merge
            tokens[i] += tokens[i + 2]
            tokens.splice(i + 1, 2)
            i--
        }
    }

    return tokens
}

wordDiff.removeEmpty = function removeEmpty(array: string[]) {
    const ret = []
    for (let i = 0; i < array.length; i++) {
        const item = array[i]
        if (
            item &&
            item !== END_RHOMBUS_EMBED_TOKEN &&
            item !== START_RHOMBUS_EMBED_TOKEN
        ) {
            ret.push(array[i])
        }
    }
    return ret
}

export default wordDiff
