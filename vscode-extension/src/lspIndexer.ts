import {
	Diagnostic,
	DiagnosticSeverity,
	DocumentSymbol,
	Location,
	SymbolKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { analyzeWithCompiler } from "./compilerBridge";
import {
	CHAR_REGEX,
	KEYWORDS,
	KEYWORD_REGEX,
	NUMBER_REGEX,
	OPERATOR_REGEX,
	STRING_REGEX,
	TYPE_NAMES,
	TYPE_REGEX,
} from "./languageData";
import { DocumentIndex, SymbolInfo, TOKEN_PRIORITY, TokenSpan, TokenType } from "./lspModel";
import { createRange, pushRegexMatches } from "./lspUtils";

type SourceLocationLike = {
	line: number;
	column: number;
};

type IdentifierLike = {
	kind: "Identifier";
	text: string;
	loc?: SourceLocationLike;
};

type AstLike = {
	kind?: string;
	loc?: SourceLocationLike;
	[key: string]: unknown;
};

export const buildIndex = (document: TextDocument): DocumentIndex => {
	const sourceText = document.getText();
	const lines = sourceText.split(/\r?\n/u);
	const bySpan = new Map<string, TokenSpan>();
	const diagnostics: Diagnostic[] = [];
	const symbols: SymbolInfo[] = [];
	const definitionsByName = new Map<string, SymbolInfo[]>();
	const referencesByName = new Map<string, Location[]>();
	const documentSymbols: DocumentSymbol[] = [];
	const functionCallRefs = new Map<string, Location[]>();
	const functionDefinitionRanges = new Map<string, Location[]>();

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

	const pushReference = (name: string, range: ReturnType<typeof createRange>): void => {
		const refs = referencesByName.get(name) ?? [];
		refs.push(Location.create(document.uri, range));
		referencesByName.set(name, refs);
	};

	const pushFunctionDefinition = (name: string, range: ReturnType<typeof createRange>): void => {
		const defs = functionDefinitionRanges.get(name) ?? [];
		defs.push(Location.create(document.uri, range));
		functionDefinitionRanges.set(name, defs);
	};

	const pushFunctionCall = (name: string, range: ReturnType<typeof createRange>): void => {
		const calls = functionCallRefs.get(name) ?? [];
		calls.push(Location.create(document.uri, range));
		functionCallRefs.set(name, calls);
		pushReference(name, range);
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
	const root = analysis.ast as AstLike | undefined;
	if (root && root.kind === "Program") {
		for (const externNode of asArray(root.externs)) {
			processFunctionLike(externNode, true);
		}
		for (const functionNode of asArray(root.functions)) {
			processFunctionLike(functionNode, false);
		}
	}

	for (const [name, defs] of functionDefinitionRanges) {
		if (defs.length <= 1) {
			continue;
		}
		for (const duplicate of defs.slice(1)) {
			diagnostics.push({
				severity: DiagnosticSeverity.Error,
				range: duplicate.range,
				message: `duplicate function declaration '${name}'`,
				source: "ekzemplo2-ls",
			});
		}
	}

	for (const [name, calls] of functionCallRefs) {
		if (functionDefinitionRanges.has(name)) {
			continue;
		}
		for (const call of calls) {
			diagnostics.push({
				severity: DiagnosticSeverity.Warning,
				range: call.range,
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

	function processFunctionLike(node: AstLike, isExtern: boolean): void {
		const name = asIdentifier(node.name);
		if (!name) {
			return;
		}
		const functionRange = rangeFromIdentifier(name);
		if (!functionRange) {
			return;
		}
		upsertTokenFromIdentifier(name, "function");
		const functionName = name.text;
		pushDefinition({
			name: functionName,
			type: "function",
			range: functionRange,
			detail: isExtern ? `extern function ${functionName}` : `function ${functionName}`,
		});
		pushFunctionDefinition(functionName, functionRange);

		const docSymbol: DocumentSymbol = {
			name: functionName,
			kind: SymbolKind.Function,
			range: functionRange,
			selectionRange: functionRange,
			detail: isExtern ? "extern" : "function",
			children: [],
		};
		documentSymbols.push(docSymbol);

		const seenParams = new Set<string>();
		for (const param of asArray(node.params)) {
			const paramName = asIdentifier((param as AstLike).name);
			if (!paramName) {
				continue;
			}
			const paramRange = rangeFromIdentifier(paramName);
			if (!paramRange) {
				continue;
			}
			upsertTokenFromIdentifier(paramName, "parameter");
			pushDefinition({
				name: paramName.text,
				type: "parameter",
				range: paramRange,
				containerName: functionName,
				detail: `${functionName} parameter`,
			});
			if (seenParams.has(paramName.text)) {
				diagnostics.push({
					severity: DiagnosticSeverity.Error,
					range: paramRange,
					message: `duplicate parameter '${paramName.text}' in function '${functionName}'`,
					source: "ekzemplo2-ls",
				});
			}
			seenParams.add(paramName.text);
		}

		if (!isExtern) {
			processStatement((node.body as AstLike) ?? undefined, functionName, docSymbol);
		}
	}

	function processStatement(
		statement: AstLike | undefined,
		currentFunction: string,
		functionSymbol: DocumentSymbol,
	): void {
		if (!statement || typeof statement.kind !== "string") {
			return;
		}
		switch (statement.kind) {
			case "Block": {
				for (const child of asArray(statement.statements)) {
					processStatement(child, currentFunction, functionSymbol);
				}
				return;
			}
			case "VarDeclStmt": {
				const name = asIdentifier(statement.name);
				if (!name) {
					processExpression(statement.initializer as AstLike | undefined);
					return;
				}
				const variableRange = rangeFromIdentifier(name);
				if (variableRange) {
					upsertTokenFromIdentifier(name, "variable");
					pushDefinition({
						name: name.text,
						type: "variable",
						range: variableRange,
						containerName: currentFunction,
					});
					functionSymbol.children = functionSymbol.children ?? [];
					functionSymbol.children.push({
						name: name.text,
						kind: SymbolKind.Variable,
						range: variableRange,
						selectionRange: variableRange,
					});
				}
				processExpression(statement.initializer as AstLike | undefined);
				return;
			}
			case "AssignStmt": {
				processAssignTarget(statement.target as AstLike | undefined);
				processExpression(statement.value as AstLike | undefined);
				return;
			}
			case "ExprStmt":
				processExpression(statement.value as AstLike | undefined);
				return;
			case "IfStmt":
				processExpression(statement.condition as AstLike | undefined);
				processStatement(
					statement.thenBranch as AstLike | undefined,
					currentFunction,
					functionSymbol,
				);
				processStatement(
					statement.elseBranch as AstLike | undefined,
					currentFunction,
					functionSymbol,
				);
				return;
			case "ForStmt":
				processStatement(statement.init as AstLike | undefined, currentFunction, functionSymbol);
				processExpression(statement.condition as AstLike | undefined);
				processStatement(statement.update as AstLike | undefined, currentFunction, functionSymbol);
				processStatement(statement.body as AstLike | undefined, currentFunction, functionSymbol);
				return;
			case "WhileStmt":
				processExpression(statement.condition as AstLike | undefined);
				processStatement(statement.body as AstLike | undefined, currentFunction, functionSymbol);
				return;
			case "ReturnStmt":
				processExpression(statement.value as AstLike | undefined);
				return;
			default:
				return;
		}
	}

	function processAssignTarget(target: AstLike | undefined): void {
		if (!target || typeof target.kind !== "string") {
			return;
		}
		if (target.kind === "Identifier") {
			processIdentifierReference(asIdentifier(target), "variable");
			return;
		}
		if (target.kind === "IndexExpr") {
			processIdentifierReference(asIdentifier(target.array), "variable");
			processExpression(target.index as AstLike | undefined);
		}
	}

	function processExpression(expr: AstLike | undefined): void {
		if (!expr || typeof expr.kind !== "string") {
			return;
		}
		switch (expr.kind) {
			case "Identifier":
				processIdentifierReference(asIdentifier(expr), "variable");
				return;
			case "CallExpr": {
				const callee = asIdentifier(expr.callee);
				if (!callee) {
					for (const arg of asArray(expr.args)) {
						processExpression(arg);
					}
					return;
				}
				const callRange = rangeFromIdentifier(callee);
				if (callRange) {
					upsertTokenFromIdentifier(callee, "function");
					pushFunctionCall(callee.text, callRange);
				}
				for (const arg of asArray(expr.args)) {
					processExpression(arg);
				}
				return;
			}
			case "IndexExpr":
				processIdentifierReference(asIdentifier(expr.array), "variable");
				processExpression(expr.index as AstLike | undefined);
				return;
			case "BinaryExpr":
				processExpression(expr.left as AstLike | undefined);
				processExpression(expr.right as AstLike | undefined);
				return;
			case "CastExpr":
				processExpression(expr.value as AstLike | undefined);
				return;
			default:
				return;
		}
	}

	function processIdentifierReference(
		identifier: IdentifierLike | undefined,
		tokenType: TokenType,
	): void {
		const range = rangeFromIdentifier(identifier);
		if (!identifier || !range) {
			return;
		}
		if (KEYWORDS.has(identifier.text) || TYPE_NAMES.has(identifier.text)) {
			return;
		}
		upsertTokenFromIdentifier(identifier, tokenType);
		pushReference(identifier.text, range);
	}

	function upsertTokenFromIdentifier(
		identifier: IdentifierLike | undefined,
		type: TokenType,
	): void {
		if (!identifier?.loc || identifier.text.length <= 0) {
			return;
		}
		const line = Math.max(0, identifier.loc.line - 1);
		const start = Math.max(0, identifier.loc.column);
		upsertToken({ line, start, length: identifier.text.length, type });
	}

	function rangeFromIdentifier(identifier: IdentifierLike | undefined) {
		if (!identifier?.loc || identifier.text.length <= 0) {
			return null;
		}
		const line = Math.max(0, identifier.loc.line - 1);
		const start = Math.max(0, identifier.loc.column);
		return createRange(line, start, identifier.text.length);
	}
};

const asArray = (value: unknown): AstLike[] => {
	return Array.isArray(value) ? (value as AstLike[]) : [];
};

const asIdentifier = (value: unknown): IdentifierLike | undefined => {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const candidate = value as IdentifierLike;
	if (candidate.kind !== "Identifier" || typeof candidate.text !== "string") {
		return undefined;
	}
	return candidate;
};
