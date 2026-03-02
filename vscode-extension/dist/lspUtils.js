"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRegexMatches = exports.countBracesDelta = exports.getWordAtPosition = exports.createRange = void 0;
const node_1 = require("vscode-languageserver/node");
const createRange = (line, start, length) => {
    return node_1.Range.create(line, start, line, start + length);
};
exports.createRange = createRange;
const getWordAtPosition = (lines, position) => {
    const line = lines[position.line] ?? "";
    if (line.length === 0) {
        return null;
    }
    let cursor = position.character;
    if (cursor >= line.length) {
        cursor = line.length - 1;
    }
    if (cursor < 0) {
        return null;
    }
    const isWord = (ch) => /[A-Za-z0-9_]/.test(ch);
    if (!isWord(line[cursor] ?? "")) {
        if (!isWord(line[cursor - 1] ?? "")) {
            return null;
        }
        cursor -= 1;
    }
    let start = cursor;
    let end = cursor;
    while (start > 0 && isWord(line[start - 1] ?? "")) {
        start -= 1;
    }
    while (end + 1 < line.length && isWord(line[end + 1] ?? "")) {
        end += 1;
    }
    const text = line.slice(start, end + 1);
    if (text.length === 0) {
        return null;
    }
    return {
        text,
        range: (0, exports.createRange)(position.line, start, text.length),
    };
};
exports.getWordAtPosition = getWordAtPosition;
const countBracesDelta = (lineText) => {
    let delta = 0;
    for (const ch of lineText) {
        if (ch === "{") {
            delta += 1;
        }
        else if (ch === "}") {
            delta -= 1;
        }
    }
    return delta;
};
exports.countBracesDelta = countBracesDelta;
const pushRegexMatches = (lineText, line, regex, type, push) => {
    for (const match of lineText.matchAll(regex)) {
        const text = match[0];
        if (!text) {
            continue;
        }
        const start = match.index ?? -1;
        if (start < 0) {
            continue;
        }
        push({
            line,
            start,
            length: text.length,
            type,
        });
    }
};
exports.pushRegexMatches = pushRegexMatches;
//# sourceMappingURL=lspUtils.js.map