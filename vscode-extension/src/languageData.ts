import { CompletionItem, CompletionItemKind, InsertTextFormat } from "vscode-languageserver/node";

export const KEYWORD_REGEX = /\b(if|else|for|while|break|continue|return|true|false)\b/g;
export const TYPE_REGEX = /\b(int|bool|string|char)\b/g;
export const NUMBER_REGEX = /\b\d+\b/g;
export const STRING_REGEX = /"(?:\\.|[^"\\\r\n])*"/g;
export const CHAR_REGEX = /'(?:\\.|[^'\\\r\n])'/g;
export const OPERATOR_REGEX = /(==|!=|<=|>=|[+\-*/=<>])/g;

export const FUNCTION_DECL_REGEX =
	/\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g;
export const VAR_DECL_REGEX =
	/\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\b(?!\s*\()/g;
export const CALL_REGEX = /\b([A-Za-z_]\w*)\s*\(/g;
export const PARAM_REGEX = /\b(?:int|bool|string|char)(?:\s*\[\s*\d+\s*\])?\s+([A-Za-z_]\w*)\b/g;

export const RESERVED_CALL_WORDS = new Set(["if", "else", "for", "while", "return"]);
export const KEYWORDS = new Set([
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
export const TYPE_NAMES = new Set(["int", "bool", "string", "char"]);

export const COMPLETIONS: CompletionItem[] = [
	{ label: "if", kind: CompletionItemKind.Keyword, insertText: "if" },
	{ label: "else", kind: CompletionItemKind.Keyword, insertText: "else" },
	{ label: "for", kind: CompletionItemKind.Keyword, insertText: "for" },
	{ label: "while", kind: CompletionItemKind.Keyword, insertText: "while" },
	{ label: "break", kind: CompletionItemKind.Keyword, insertText: "break" },
	{ label: "continue", kind: CompletionItemKind.Keyword, insertText: "continue" },
	{ label: "return", kind: CompletionItemKind.Keyword, insertText: "return" },
	{ label: "extern", kind: CompletionItemKind.Keyword, insertText: "extern" },
	{ label: "int", kind: CompletionItemKind.Keyword, insertText: "int" },
	{ label: "bool", kind: CompletionItemKind.Keyword, insertText: "bool" },
	{ label: "string", kind: CompletionItemKind.Keyword, insertText: "string" },
	{ label: "char", kind: CompletionItemKind.Keyword, insertText: "char" },
	{
		label: "if (snippet)",
		kind: CompletionItemKind.Snippet,
		insertTextFormat: InsertTextFormat.Snippet,
		insertText: "if (${1:condition}) {\n\t$0\n}",
	},
	{
		label: "for (snippet)",
		kind: CompletionItemKind.Snippet,
		insertTextFormat: InsertTextFormat.Snippet,
		insertText: "for (${1:init}; ${2:cond}; ${3:update}) {\n\t$0\n}",
	},
	{
		label: "while (snippet)",
		kind: CompletionItemKind.Snippet,
		insertTextFormat: InsertTextFormat.Snippet,
		insertText: "while (${1:condition}) {\n\t$0\n}",
	},
];
