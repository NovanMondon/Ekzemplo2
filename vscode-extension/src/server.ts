import {
	createConnection,
	Definition,
	InitializeParams,
	Location,
	MarkupKind,
	ProposedFeatures,
	ReferenceParams,
	SemanticTokensBuilder,
	SemanticTokensParams,
	TextDocumentSyncKind,
	TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { buildIndex } from "./lspIndexer";
import { COMPLETIONS, KEYWORDS, TYPE_NAMES } from "./languageData";
import { DocumentIndex, TOKEN_TYPES, TOKEN_TYPE_INDEX } from "./lspModel";
import { getWordAtPosition } from "./lspUtils";

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const indexes = new Map<string, DocumentIndex>();

const rangeKey = (line: number, start: number, end: number): string => {
	return `${line}:${start}:${end}`;
};

connection.onInitialize((_params: InitializeParams) => {
	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: {
				triggerCharacters: [".", "(", " "],
			},
			hoverProvider: true,
			definitionProvider: true,
			referencesProvider: true,
			documentSymbolProvider: true,
			semanticTokensProvider: {
				legend: {
					tokenTypes: [...TOKEN_TYPES],
					tokenModifiers: [],
				},
				full: true,
			},
		},
	};
});

documents.onDidOpen((event) => {
	updateIndex(event.document);
});

documents.onDidChangeContent((event) => {
	updateIndex(event.document);
});

documents.onDidClose((event) => {
	indexes.delete(event.document.uri);
	connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onCompletion((_params) => {
	return COMPLETIONS;
});

connection.onHover((params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}
	const index = getOrBuildIndex(document);
	const word = getWordAtPosition(index.lines, params.position);
	if (!word) {
		return null;
	}
	const key = rangeKey(word.range.start.line, word.range.start.character, word.range.end.character);
	const scopedDefinitionIds = index.definitionIdsByRangeKey.get(key) ?? [];
	const symbol =
		(scopedDefinitionIds.length > 0
			? index.symbolByDefinitionId.get(scopedDefinitionIds[0])
			: undefined) ?? (index.definitionsByName.get(word.text) ?? [])[0];
	if (!symbol) {
		if (KEYWORDS.has(word.text) || TYPE_NAMES.has(word.text)) {
			return {
				contents: {
					kind: MarkupKind.Markdown,
					value: `\`${word.text}\``,
				},
				range: word.range,
			};
		}
		return null;
	}
	const signature = symbol.detail
		? symbol.detail
		: symbol.type === "function"
			? `function ${symbol.name}`
			: `${symbol.type} ${symbol.name}`;
	return {
		contents: {
			kind: MarkupKind.Markdown,
			value: `\`${signature}\``,
		},
		range: word.range,
	};
});

connection.onDefinition((params): Definition | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}
	const index = getOrBuildIndex(document);
	const word = getWordAtPosition(index.lines, params.position);
	if (!word) {
		return null;
	}
	const key = rangeKey(word.range.start.line, word.range.start.character, word.range.end.character);
	const scopedDefinitions = index.definitionTargetsByRangeKey.get(key) ?? [];
	if (scopedDefinitions.length > 0) {
		return scopedDefinitions;
	}
	const definitions = index.definitionsByName.get(word.text) ?? [];
	if (definitions.length === 0) {
		return null;
	}
	return definitions.map((definition) => Location.create(index.uri, definition.range));
});

connection.onReferences((params: ReferenceParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}
	const index = getOrBuildIndex(document);
	const word = getWordAtPosition(index.lines, params.position);
	if (!word) {
		return [];
	}
	const key = rangeKey(word.range.start.line, word.range.start.character, word.range.end.character);
	const scopedDefinitionIds = index.definitionIdsByRangeKey.get(key) ?? [];
	if (scopedDefinitionIds.length > 0) {
		const merged = new Map<string, Location>();
		for (const definitionId of scopedDefinitionIds) {
			const scopedRefs = index.referencesByDefinitionId.get(definitionId) ?? [];
			for (const location of scopedRefs) {
				const locationKey = `${location.uri}:${location.range.start.line}:${location.range.start.character}:${location.range.end.character}`;
				merged.set(locationKey, location);
			}

			if (params.context.includeDeclaration) {
				const definitionLocation = index.locationByDefinitionId.get(definitionId);
				if (definitionLocation) {
					const locationKey = `${definitionLocation.uri}:${definitionLocation.range.start.line}:${definitionLocation.range.start.character}:${definitionLocation.range.end.character}`;
					merged.set(locationKey, definitionLocation);
				}
			}
		}
		return [...merged.values()];
	}

	const references = index.referencesByName.get(word.text) ?? [];
	if (!params.context.includeDeclaration) {
		return references;
	}
	const definitions = (index.definitionsByName.get(word.text) ?? []).map((definition) =>
		Location.create(index.uri, definition.range),
	);
	const merged = new Map<string, Location>();
	for (const location of [...definitions, ...references]) {
		const key = `${location.uri}:${location.range.start.line}:${location.range.start.character}:${location.range.end.character}`;
		merged.set(key, location);
	}
	return [...merged.values()];
});

connection.onDocumentSymbol((params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}
	const index = getOrBuildIndex(document);
	return index.documentSymbols;
});

connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return { data: [] };
	}

	const index = getOrBuildIndex(document);
	const builder = new SemanticTokensBuilder();
	for (const span of index.tokenSpans) {
		builder.push(span.line, span.start, span.length, TOKEN_TYPE_INDEX[span.type], 0);
	}

	return builder.build();
});

documents.listen(connection);
connection.listen();

const getOrBuildIndex = (document: TextDocument): DocumentIndex => {
	const existing = indexes.get(document.uri);
	if (existing) {
		return existing;
	}
	const created = buildIndex(document);
	indexes.set(document.uri, created);
	return created;
};

const updateIndex = (document: TextDocument): void => {
	const index = buildIndex(document);
	indexes.set(document.uri, index);
	connection.sendDiagnostics({
		uri: document.uri,
		diagnostics: index.diagnostics,
	});
};
