"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPLETIONS = exports.TYPE_NAMES = exports.KEYWORDS = exports.RESERVED_CALL_WORDS = exports.PARAM_REGEX = exports.CALL_REGEX = exports.VAR_DECL_REGEX = exports.FUNCTION_DECL_REGEX = exports.OPERATOR_REGEX = exports.CHAR_REGEX = exports.STRING_REGEX = exports.NUMBER_REGEX = exports.TYPE_REGEX = exports.KEYWORD_REGEX = void 0;
const node_1 = require("vscode-languageserver/node");
exports.KEYWORD_REGEX = /\b(if|else|for|while|break|continue|return|true|false)\b/g;
exports.TYPE_REGEX = /\b(int|bool|string|char)\b/g;
exports.NUMBER_REGEX = /\b\d+\b/g;
exports.STRING_REGEX = /"(?:\\.|[^"\\\r\n])*"/g;
exports.CHAR_REGEX = /'(?:\\.|[^'\\\r\n])'/g;
exports.OPERATOR_REGEX = /(==|!=|<=|>=|[+\-*/=<>])/g;
exports.FUNCTION_DECL_REGEX = /\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g;
exports.VAR_DECL_REGEX = /\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\b(?!\s*\()/g;
exports.CALL_REGEX = /\b([A-Za-z_]\w*)\s*\(/g;
exports.PARAM_REGEX = /\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\b/g;
exports.RESERVED_CALL_WORDS = new Set(["if", "else", "for", "while", "return"]);
exports.KEYWORDS = new Set([
    "if",
    "else",
    "for",
    "while",
    "break",
    "continue",
    "return",
    "true",
    "false",
    "extern",
]);
exports.TYPE_NAMES = new Set(["int", "bool", "string", "char"]);
exports.COMPLETIONS = [
    { label: "if", kind: node_1.CompletionItemKind.Keyword, insertText: "if" },
    { label: "else", kind: node_1.CompletionItemKind.Keyword, insertText: "else" },
    { label: "for", kind: node_1.CompletionItemKind.Keyword, insertText: "for" },
    { label: "while", kind: node_1.CompletionItemKind.Keyword, insertText: "while" },
    { label: "break", kind: node_1.CompletionItemKind.Keyword, insertText: "break" },
    { label: "continue", kind: node_1.CompletionItemKind.Keyword, insertText: "continue" },
    { label: "return", kind: node_1.CompletionItemKind.Keyword, insertText: "return" },
    { label: "extern", kind: node_1.CompletionItemKind.Keyword, insertText: "extern" },
    { label: "int", kind: node_1.CompletionItemKind.Keyword, insertText: "int" },
    { label: "bool", kind: node_1.CompletionItemKind.Keyword, insertText: "bool" },
    { label: "string", kind: node_1.CompletionItemKind.Keyword, insertText: "string" },
    { label: "char", kind: node_1.CompletionItemKind.Keyword, insertText: "char" },
    {
        label: "if (snippet)",
        kind: node_1.CompletionItemKind.Snippet,
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        insertText: "if (${1:condition}) {\n\t$0\n}",
    },
    {
        label: "for (snippet)",
        kind: node_1.CompletionItemKind.Snippet,
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        insertText: "for (${1:init}; ${2:cond}; ${3:update}) {\n\t$0\n}",
    },
    {
        label: "while (snippet)",
        kind: node_1.CompletionItemKind.Snippet,
        insertTextFormat: node_1.InsertTextFormat.Snippet,
        insertText: "while (${1:condition}) {\n\t$0\n}",
    },
];
//# sourceMappingURL=languageData.js.map