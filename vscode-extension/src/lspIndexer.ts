import {
	Diagnostic,
	DocumentSymbol,
	Location,
	Range,
	SymbolKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { analyzeWithCompiler } from "./compilerBridge";
import {
	CHAR_REGEX,
	KEYWORD_REGEX,
	NUMBER_REGEX,
	OPERATOR_REGEX,
	STRING_REGEX,
	TYPE_REGEX,
} from "./languageData";
import { DocumentIndex, SymbolInfo, TOKEN_PRIORITY, TokenSpan, TokenType } from "./lspModel";
import { createRange, pushRegexMatches } from "./lspUtils";

const rangeKey = (range: Range): string => {
	return `${range.start.line}:${range.start.character}:${range.end.character}`;
};

export const buildIndex = (document: TextDocument): DocumentIndex => {
	const sourceText = document.getText();
	const lines = sourceText.split(/\r?\n/u);
	const bySpan = new Map<string, TokenSpan>();
	const diagnostics: Diagnostic[] = [];
	const symbols: SymbolInfo[] = [];
	const definitionsByName = new Map<string, SymbolInfo[]>();
	const referencesByName = new Map<string, Location[]>();
	const definitionTargetsByRangeKey = new Map<string, Location[]>();
	const definitionIdsByRangeKey = new Map<string, string[]>();
	const referencesByDefinitionId = new Map<string, Location[]>();
	const symbolByDefinitionId = new Map<string, SymbolInfo>();
	const locationByDefinitionId = new Map<string, Location>();
	const documentSymbols: DocumentSymbol[] = [];
	const functionSymbolsByName = new Map<string, DocumentSymbol>();

	const upsertToken = (token: TokenSpan): void => {
		if (token.length <= 0) {
			return;
		}
		const key = `${token.line}:${token.start}:${token.length}`;
		const current = bySpan.get(key);
		if (!current || TOKEN_PRIORITY[token.type] > TOKEN_PRIORITY[current.type]) {
			bySpan.set(key, token);
		}
	};

	const pushDefinition = (symbol: SymbolInfo): void => {
		symbols.push(symbol);
		const defs = definitionsByName.get(symbol.name) ?? [];
		defs.push(symbol);
		definitionsByName.set(symbol.name, defs);
	};

	const pushReferenceByName = (name: string, location: Location): void => {
		const refs = referencesByName.get(name) ?? [];
		refs.push(location);
		referencesByName.set(name, refs);
	};

	const addDefinitionTarget = (key: string, location: Location): void => {
		const existing = definitionTargetsByRangeKey.get(key) ?? [];
		if (
			existing.some(
				(item) =>
					item.range.start.line === location.range.start.line &&
					item.range.start.character === location.range.start.character &&
					item.range.end.character === location.range.end.character,
			)
		) {
			return;
		}
		existing.push(location);
		definitionTargetsByRangeKey.set(key, existing);
	};

	const addDefinitionIdAtRange = (key: string, definitionId: string): void => {
		const existing = definitionIdsByRangeKey.get(key) ?? [];
		if (!existing.includes(definitionId)) {
			existing.push(definitionId);
			definitionIdsByRangeKey.set(key, existing);
		}
	};

	const addReferenceForDefinition = (definitionId: string, location: Location): void => {
		const refs = referencesByDefinitionId.get(definitionId) ?? [];
		refs.push(location);
		referencesByDefinitionId.set(definitionId, refs);
	};

	const tokenTypeFromSymbolType = (
		symbolType: "function" | "variable" | "parameter",
	): TokenType => {
		switch (symbolType) {
			case "function":
				return "function";
			case "parameter":
				return "parameter";
			case "variable":
				return "variable";
		}
	};

	lines.forEach((lineText, line) => {
		pushRegexMatches(lineText, line, KEYWORD_REGEX, "keyword", upsertToken);
		pushRegexMatches(lineText, line, TYPE_REGEX, "type", upsertToken);
		pushRegexMatches(lineText, line, NUMBER_REGEX, "number", upsertToken);
		pushRegexMatches(lineText, line, STRING_REGEX, "string", upsertToken);
		pushRegexMatches(lineText, line, CHAR_REGEX, "string", upsertToken);
		pushRegexMatches(lineText, line, OPERATOR_REGEX, "operator", upsertToken);
	});

	const analysis = analyzeWithCompiler(sourceText);
	diagnostics.push(...analysis.diagnostics);
	const compilerIndex = analysis.lspIndex;
	if (!compilerIndex) {
		return {
			uri: document.uri,
			lines,
			tokenSpans: [...bySpan.values()].sort((a, b) => {
				if (a.line !== b.line) {
					return a.line - b.line;
				}
				return a.start - b.start;
			}),
			diagnostics,
			symbols,
			definitionsByName,
			referencesByName,
			definitionTargetsByRangeKey,
			definitionIdsByRangeKey,
			referencesByDefinitionId,
			symbolByDefinitionId,
			locationByDefinitionId,
			documentSymbols,
		};
	}

	for (const definition of compilerIndex.definitions) {
		const range = createRange(definition.line, definition.column, definition.length);
		upsertToken({
			line: definition.line,
			start: definition.column,
			length: definition.length,
			type: tokenTypeFromSymbolType(definition.symbolType),
		});

		const symbol: SymbolInfo = {
			name: definition.name,
			type: definition.symbolType,
			range,
			containerName: definition.containerName,
			detail: definition.detail,
		};
		pushDefinition(symbol);
		symbolByDefinitionId.set(definition.id, symbol);

		const location = Location.create(document.uri, range);
		locationByDefinitionId.set(definition.id, location);
		addDefinitionTarget(rangeKey(range), location);
		addDefinitionIdAtRange(rangeKey(range), definition.id);
		referencesByDefinitionId.set(definition.id, referencesByDefinitionId.get(definition.id) ?? []);

		if (definition.symbolType === "function") {
			const functionSymbol: DocumentSymbol = {
				name: definition.name,
				kind: SymbolKind.Function,
				range,
				selectionRange: range,
				detail: definition.detail ?? "function",
				children: [],
			};
			documentSymbols.push(functionSymbol);
			functionSymbolsByName.set(definition.name, functionSymbol);
			continue;
		}

		if (definition.symbolType === "variable") {
			const owner = definition.containerName
				? functionSymbolsByName.get(definition.containerName)
				: undefined;
			if (owner) {
				owner.children = owner.children ?? [];
				owner.children.push({
					name: definition.name,
					kind: SymbolKind.Variable,
					range,
					selectionRange: range,
				});
			}
		}
	}

	for (const reference of compilerIndex.references) {
		const range = createRange(reference.line, reference.column, reference.length);
		upsertToken({
			line: reference.line,
			start: reference.column,
			length: reference.length,
			type: reference.symbolType === "function" ? "function" : "variable",
		});
		const location = Location.create(document.uri, range);
		pushReferenceByName(reference.name, location);

		if (!reference.resolvedDefinitionId) {
			continue;
		}
		const definitionLocation = locationByDefinitionId.get(reference.resolvedDefinitionId);
		if (!definitionLocation) {
			continue;
		}
		addDefinitionTarget(rangeKey(range), definitionLocation);
		addDefinitionIdAtRange(rangeKey(range), reference.resolvedDefinitionId);
		addReferenceForDefinition(reference.resolvedDefinitionId, location);
	}

	return {
		uri: document.uri,
		lines,
		tokenSpans: [...bySpan.values()].sort((a, b) => {
			if (a.line !== b.line) {
				return a.line - b.line;
			}
			return a.start - b.start;
		}),
		diagnostics,
		symbols,
		definitionsByName,
		referencesByName,
		definitionTargetsByRangeKey,
		definitionIdsByRangeKey,
		referencesByDefinitionId,
		symbolByDefinitionId,
		locationByDefinitionId,
		documentSymbols,
	};
};
