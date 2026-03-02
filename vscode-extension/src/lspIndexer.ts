import {
	Diagnostic,
	DiagnosticSeverity,
	DocumentSymbol,
	Location,
	Range,
	SymbolKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
	CALL_REGEX,
	CHAR_REGEX,
	FUNCTION_DECL_REGEX,
	KEYWORDS,
	KEYWORD_REGEX,
	NUMBER_REGEX,
	OPERATOR_REGEX,
	PARAM_REGEX,
	RESERVED_CALL_WORDS,
	STRING_REGEX,
	TYPE_NAMES,
	TYPE_REGEX,
	VAR_DECL_REGEX,
} from "./languageData";
import { TOKEN_PRIORITY, DocumentIndex, SymbolInfo, TokenSpan } from "./lspModel";
import { countBracesDelta, createRange, pushRegexMatches } from "./lspUtils";

export const buildIndex = (document: TextDocument): DocumentIndex => {
	const sourceText = document.getText();
	const lines = sourceText.split(/\r?\n/u);
	const bySpan = new Map<string, TokenSpan>();
	const diagnostics: Diagnostic[] = [];
	const symbols: SymbolInfo[] = [];
	const definitionsByName = new Map<string, SymbolInfo[]>();
	const referencesByName = new Map<string, Location[]>();
	const documentSymbols: DocumentSymbol[] = [];
	const functionOccurrences = new Map<string, Range[]>();
	const functionDeclSpansByLine = new Map<number, Array<{ start: number; end: number }>>();

	let currentFunction: string | undefined;
	let currentFunctionSymbol: DocumentSymbol | undefined;
	let currentFunctionBraceDepth = 0;

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

	const pushReference = (name: string, range: Range): void => {
		const refs = referencesByName.get(name) ?? [];
		refs.push(Location.create(document.uri, range));
		referencesByName.set(name, refs);
	};

	lines.forEach((lineText, line) => {
		const trimmed = lineText.trim();
		if (trimmed.startsWith("//")) {
			return;
		}

		pushRegexMatches(lineText, line, KEYWORD_REGEX, "keyword", upsertToken);
		pushRegexMatches(lineText, line, TYPE_REGEX, "type", upsertToken);
		pushRegexMatches(lineText, line, NUMBER_REGEX, "number", upsertToken);
		pushRegexMatches(lineText, line, STRING_REGEX, "string", upsertToken);
		pushRegexMatches(lineText, line, CHAR_REGEX, "string", upsertToken);
		pushRegexMatches(lineText, line, OPERATOR_REGEX, "operator", upsertToken);

		const functionDeclSpans = functionDeclSpansByLine.get(line) ?? [];
		for (const decl of lineText.matchAll(FUNCTION_DECL_REGEX)) {
			const name = decl[1];
			if (!name) {
				continue;
			}
			const full = decl[0] ?? "";
			const matchStart = decl.index ?? 0;
			const matchEnd = matchStart + full.length;
			functionDeclSpans.push({ start: matchStart, end: matchEnd });
			const nameOffsetInMatch = full.indexOf(name);
			if (nameOffsetInMatch >= 0) {
				const range = createRange(line, matchStart + nameOffsetInMatch, name.length);
				upsertToken({
					line,
					start: matchStart + nameOffsetInMatch,
					length: name.length,
					type: "function",
				});

				const symbol: SymbolInfo = {
					name,
					type: "function",
					range,
					detail: full.trim(),
				};
				pushDefinition(symbol);
				pushReference(name, range);
				const occurrences = functionOccurrences.get(name) ?? [];
				occurrences.push(range);
				functionOccurrences.set(name, occurrences);
				const functionDocSymbol: DocumentSymbol = {
					name,
					kind: SymbolKind.Function,
					range,
					selectionRange: range,
					detail: full.trim(),
					children: [],
				};
				documentSymbols.push(functionDocSymbol);
				if (lineText.includes("{") && !lineText.includes(";")) {
					currentFunction = name;
					currentFunctionSymbol = functionDocSymbol;
					currentFunctionBraceDepth = countBracesDelta(lineText);
				}
			}

			const paramsText = decl[2] ?? "";
			const paramsOffsetInMatch = full.indexOf(paramsText);
			if (paramsOffsetInMatch < 0 || paramsText.trim().length === 0) {
				continue;
			}
			const seenParams = new Set<string>();
			for (const param of paramsText.matchAll(PARAM_REGEX)) {
				const paramName = param[1];
				if (!paramName) {
					continue;
				}
				const paramFull = param[0] ?? "";
				const paramNameOffset = paramFull.indexOf(paramName);
				const paramStart = param.index ?? 0;
				if (paramNameOffset < 0) {
					continue;
				}
				const start = matchStart + paramsOffsetInMatch + paramStart + paramNameOffset;
				const range = createRange(line, start, paramName.length);
				upsertToken({ line, start, length: paramName.length, type: "parameter" });
				const symbol: SymbolInfo = {
					name: paramName,
					type: "parameter",
					range,
					containerName: name,
					detail: `${name} parameter`,
				};
				pushDefinition(symbol);
				pushReference(paramName, range);
				if (seenParams.has(paramName)) {
					diagnostics.push({
						severity: DiagnosticSeverity.Error,
						range,
						message: `duplicate parameter '${paramName}' in function '${name}'`,
						source: "ekzemplo2-ls",
					});
				}
				seenParams.add(paramName);
			}
		}
		functionDeclSpansByLine.set(line, functionDeclSpans);

		for (const variable of lineText.matchAll(VAR_DECL_REGEX)) {
			const variableName = variable[1];
			if (!variableName) {
				continue;
			}
			const variableFull = variable[0] ?? "";
			const variableStart = variable.index ?? 0;
			const variableNameOffset = variableFull.indexOf(variableName);
			if (variableNameOffset >= 0) {
				const start = variableStart + variableNameOffset;
				const range = createRange(line, start, variableName.length);
				upsertToken({ line, start, length: variableName.length, type: "variable" });
				const symbol: SymbolInfo = {
					name: variableName,
					type: "variable",
					range,
					containerName: currentFunction,
				};
				pushDefinition(symbol);
				pushReference(variableName, range);
				if (currentFunctionSymbol) {
					currentFunctionSymbol.children = currentFunctionSymbol.children ?? [];
					currentFunctionSymbol.children.push({
						name: variableName,
						kind: SymbolKind.Variable,
						range,
						selectionRange: range,
					});
				}
			}
		}

		for (const call of lineText.matchAll(CALL_REGEX)) {
			const callee = call[1];
			if (!callee || RESERVED_CALL_WORDS.has(callee)) {
				continue;
			}
			const callStart = call.index ?? 0;
			const insideDeclaration = functionDeclSpans.some(
				(span) => callStart >= span.start && callStart <= span.end,
			);
			if (insideDeclaration) {
				continue;
			}
			const range = createRange(line, callStart, callee.length);
			upsertToken({
				line,
				start: callStart,
				length: callee.length,
				type: "function",
			});
			pushReference(callee, range);
		}

		for (const identifier of lineText.matchAll(/\b[A-Za-z_]\w*\b/g)) {
			const name = identifier[0] ?? "";
			if (!name || KEYWORDS.has(name) || TYPE_NAMES.has(name)) {
				continue;
			}
			const start = identifier.index ?? -1;
			if (start < 0) {
				continue;
			}
			pushReference(name, createRange(line, start, name.length));
		}

		if (currentFunction) {
			currentFunctionBraceDepth += countBracesDelta(lineText);
			if (currentFunctionBraceDepth <= 0) {
				currentFunction = undefined;
				currentFunctionSymbol = undefined;
				currentFunctionBraceDepth = 0;
			}
		}
	});

	for (const [name, ranges] of functionOccurrences) {
		if (ranges.length <= 1) {
			continue;
		}
		for (const range of ranges.slice(1)) {
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range,
				message: `duplicate function declaration '${name}'`,
				source: "ekzemplo2-ls",
			});
		}
	}

	const functionNames = new Set(functionOccurrences.keys());
	for (const [name, refs] of referencesByName) {
		if (functionNames.has(name) || KEYWORDS.has(name) || TYPE_NAMES.has(name)) {
			continue;
		}
		if ((definitionsByName.get(name) ?? []).some((symbol) => symbol.type !== "function")) {
			continue;
		}
		for (const ref of refs) {
			const lineText = lines[ref.range.start.line] ?? "";
			const nextChar = lineText[ref.range.end.character] ?? "";
			if (nextChar !== "(") {
				continue;
			}
			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range: ref.range,
				message: `call to undefined function '${name}'`,
				source: "ekzemplo2-ls",
			});
		}
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
		documentSymbols,
	};
};
