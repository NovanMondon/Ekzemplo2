"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const lspIndexer_1 = require("./lspIndexer");
const languageData_1 = require("./languageData");
const lspModel_1 = require("./lspModel");
const lspUtils_1 = require("./lspUtils");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const indexes = new Map();
const rangeKey = (line, start, end) => {
    return `${line}:${start}:${end}`;
};
connection.onInitialize((_params) => {
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                triggerCharacters: [".", "(", " "],
            },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            semanticTokensProvider: {
                legend: {
                    tokenTypes: [...lspModel_1.TOKEN_TYPES],
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
    return languageData_1.COMPLETIONS;
});
connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const index = getOrBuildIndex(document);
    const word = (0, lspUtils_1.getWordAtPosition)(index.lines, params.position);
    if (!word) {
        return null;
    }
    const key = rangeKey(word.range.start.line, word.range.start.character, word.range.end.character);
    const scopedDefinitionIds = index.definitionIdsByRangeKey.get(key) ?? [];
    const symbol = (scopedDefinitionIds.length > 0
        ? index.symbolByDefinitionId.get(scopedDefinitionIds[0])
        : undefined) ?? (index.definitionsByName.get(word.text) ?? [])[0];
    if (!symbol) {
        if (languageData_1.KEYWORDS.has(word.text) || languageData_1.TYPE_NAMES.has(word.text)) {
            return {
                contents: {
                    kind: node_1.MarkupKind.Markdown,
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
            kind: node_1.MarkupKind.Markdown,
            value: `\`${signature}\``,
        },
        range: word.range,
    };
});
connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const index = getOrBuildIndex(document);
    const word = (0, lspUtils_1.getWordAtPosition)(index.lines, params.position);
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
    return definitions.map((definition) => node_1.Location.create(index.uri, definition.range));
});
connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const index = getOrBuildIndex(document);
    const word = (0, lspUtils_1.getWordAtPosition)(index.lines, params.position);
    if (!word) {
        return [];
    }
    const key = rangeKey(word.range.start.line, word.range.start.character, word.range.end.character);
    const scopedDefinitionIds = index.definitionIdsByRangeKey.get(key) ?? [];
    if (scopedDefinitionIds.length > 0) {
        const merged = new Map();
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
    const definitions = (index.definitionsByName.get(word.text) ?? []).map((definition) => node_1.Location.create(index.uri, definition.range));
    const merged = new Map();
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
connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return { data: [] };
    }
    const index = getOrBuildIndex(document);
    const builder = new node_1.SemanticTokensBuilder();
    for (const span of index.tokenSpans) {
        builder.push(span.line, span.start, span.length, lspModel_1.TOKEN_TYPE_INDEX[span.type], 0);
    }
    return builder.build();
});
documents.listen(connection);
connection.listen();
const getOrBuildIndex = (document) => {
    const existing = indexes.get(document.uri);
    if (existing) {
        return existing;
    }
    const created = (0, lspIndexer_1.buildIndex)(document);
    indexes.set(document.uri, created);
    return created;
};
const updateIndex = (document) => {
    const index = (0, lspIndexer_1.buildIndex)(document);
    indexes.set(document.uri, index);
    connection.sendDiagnostics({
        uri: document.uri,
        diagnostics: index.diagnostics,
    });
};
//# sourceMappingURL=server.js.map