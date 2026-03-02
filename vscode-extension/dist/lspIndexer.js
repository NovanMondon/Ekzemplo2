"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndex = void 0;
const node_1 = require("vscode-languageserver/node");
const compilerBridge_1 = require("./compilerBridge");
const languageData_1 = require("./languageData");
const lspModel_1 = require("./lspModel");
const lspUtils_1 = require("./lspUtils");
const rangeKey = (range) => {
    return `${range.start.line}:${range.start.character}:${range.end.character}`;
};
const buildIndex = (document) => {
    const sourceText = document.getText();
    const lines = sourceText.split(/\r?\n/u);
    const bySpan = new Map();
    const diagnostics = [];
    const symbols = [];
    const definitionsByName = new Map();
    const referencesByName = new Map();
    const definitionTargetsByRangeKey = new Map();
    const definitionIdsByRangeKey = new Map();
    const referencesByDefinitionId = new Map();
    const symbolByDefinitionId = new Map();
    const locationByDefinitionId = new Map();
    const documentSymbols = [];
    const functionSymbolsByName = new Map();
    const upsertToken = (token) => {
        if (token.length <= 0) {
            return;
        }
        const key = `${token.line}:${token.start}:${token.length}`;
        const current = bySpan.get(key);
        if (!current || lspModel_1.TOKEN_PRIORITY[token.type] > lspModel_1.TOKEN_PRIORITY[current.type]) {
            bySpan.set(key, token);
        }
    };
    const pushDefinition = (symbol) => {
        symbols.push(symbol);
        const defs = definitionsByName.get(symbol.name) ?? [];
        defs.push(symbol);
        definitionsByName.set(symbol.name, defs);
    };
    const pushReferenceByName = (name, location) => {
        const refs = referencesByName.get(name) ?? [];
        refs.push(location);
        referencesByName.set(name, refs);
    };
    const addDefinitionTarget = (key, location) => {
        const existing = definitionTargetsByRangeKey.get(key) ?? [];
        if (existing.some((item) => item.range.start.line === location.range.start.line &&
            item.range.start.character === location.range.start.character &&
            item.range.end.character === location.range.end.character)) {
            return;
        }
        existing.push(location);
        definitionTargetsByRangeKey.set(key, existing);
    };
    const addDefinitionIdAtRange = (key, definitionId) => {
        const existing = definitionIdsByRangeKey.get(key) ?? [];
        if (!existing.includes(definitionId)) {
            existing.push(definitionId);
            definitionIdsByRangeKey.set(key, existing);
        }
    };
    const addReferenceForDefinition = (definitionId, location) => {
        const refs = referencesByDefinitionId.get(definitionId) ?? [];
        refs.push(location);
        referencesByDefinitionId.set(definitionId, refs);
    };
    const tokenTypeFromSymbolType = (symbolType) => {
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
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.KEYWORD_REGEX, "keyword", upsertToken);
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.TYPE_REGEX, "type", upsertToken);
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.NUMBER_REGEX, "number", upsertToken);
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.STRING_REGEX, "string", upsertToken);
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.CHAR_REGEX, "string", upsertToken);
        (0, lspUtils_1.pushRegexMatches)(lineText, line, languageData_1.OPERATOR_REGEX, "operator", upsertToken);
    });
    const analysis = (0, compilerBridge_1.analyzeWithCompiler)(sourceText);
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
        const range = (0, lspUtils_1.createRange)(definition.line, definition.column, definition.length);
        upsertToken({
            line: definition.line,
            start: definition.column,
            length: definition.length,
            type: tokenTypeFromSymbolType(definition.symbolType),
        });
        const symbol = {
            name: definition.name,
            type: definition.symbolType,
            range,
            containerName: definition.containerName,
            detail: definition.detail,
        };
        pushDefinition(symbol);
        symbolByDefinitionId.set(definition.id, symbol);
        const location = node_1.Location.create(document.uri, range);
        locationByDefinitionId.set(definition.id, location);
        addDefinitionTarget(rangeKey(range), location);
        addDefinitionIdAtRange(rangeKey(range), definition.id);
        referencesByDefinitionId.set(definition.id, referencesByDefinitionId.get(definition.id) ?? []);
        if (definition.symbolType === "function") {
            const functionSymbol = {
                name: definition.name,
                kind: node_1.SymbolKind.Function,
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
            const owner = definition.containerName ? functionSymbolsByName.get(definition.containerName) : undefined;
            if (owner) {
                owner.children = owner.children ?? [];
                owner.children.push({
                    name: definition.name,
                    kind: node_1.SymbolKind.Variable,
                    range,
                    selectionRange: range,
                });
            }
        }
    }
    for (const reference of compilerIndex.references) {
        const range = (0, lspUtils_1.createRange)(reference.line, reference.column, reference.length);
        upsertToken({
            line: reference.line,
            start: reference.column,
            length: reference.length,
            type: reference.symbolType === "function" ? "function" : "variable",
        });
        const location = node_1.Location.create(document.uri, range);
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
exports.buildIndex = buildIndex;
//# sourceMappingURL=lspIndexer.js.map