import { Diagnostic, DocumentSymbol, Location, Range } from "vscode-languageserver/node";

export const TOKEN_TYPES = [
	"type",
	"parameter",
	"variable",
	"function",
	"keyword",
	"string",
	"number",
	"operator",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export const TOKEN_TYPE_INDEX: Record<TokenType, number> = {
	type: 0,
	parameter: 1,
	variable: 2,
	function: 3,
	keyword: 4,
	string: 5,
	number: 6,
	operator: 7,
};

export const TOKEN_PRIORITY: Record<TokenType, number> = {
	operator: 1,
	number: 2,
	string: 3,
	keyword: 4,
	type: 5,
	variable: 6,
	parameter: 7,
	function: 8,
};

export type TokenSpan = {
	line: number;
	start: number;
	length: number;
	type: TokenType;
};

export type SymbolType = "function" | "variable" | "parameter";

export type SymbolInfo = {
	name: string;
	type: SymbolType;
	range: Range;
	containerName?: string;
	detail?: string;
};

export type DocumentIndex = {
	uri: string;
	lines: string[];
	tokenSpans: TokenSpan[];
	diagnostics: Diagnostic[];
	symbols: SymbolInfo[];
	definitionsByName: Map<string, SymbolInfo[]>;
	referencesByName: Map<string, Location[]>;
	definitionTargetsByRangeKey: Map<string, Location[]>;
	definitionIdsByRangeKey: Map<string, string[]>;
	referencesByDefinitionId: Map<string, Location[]>;
	symbolByDefinitionId: Map<string, SymbolInfo>;
	locationByDefinitionId: Map<string, Location>;
	documentSymbols: DocumentSymbol[];
};
