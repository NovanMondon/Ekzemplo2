"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndex = void 0;
const node_1 = require("vscode-languageserver/node");
const compilerBridge_1 = require("./compilerBridge");
const languageData_1 = require("./languageData");
const lspModel_1 = require("./lspModel");
const lspUtils_1 = require("./lspUtils");
const buildIndex = (document) => {
    const sourceText = document.getText();
    const lines = sourceText.split(/\r?\n/u);
    const bySpan = new Map();
    const diagnostics = [];
    const symbols = [];
    const definitionsByName = new Map();
    const referencesByName = new Map();
    const documentSymbols = [];
    const functionCallRefs = new Map();
    const functionDefinitionRanges = new Map();
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
    const pushReference = (name, range) => {
        const refs = referencesByName.get(name) ?? [];
        refs.push(node_1.Location.create(document.uri, range));
        referencesByName.set(name, refs);
    };
    const pushFunctionDefinition = (name, range) => {
        const defs = functionDefinitionRanges.get(name) ?? [];
        defs.push(node_1.Location.create(document.uri, range));
        functionDefinitionRanges.set(name, defs);
    };
    const pushFunctionCall = (name, range) => {
        const calls = functionCallRefs.get(name) ?? [];
        calls.push(node_1.Location.create(document.uri, range));
        functionCallRefs.set(name, calls);
        pushReference(name, range);
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
    const root = analysis.ast;
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
                severity: node_1.DiagnosticSeverity.Error,
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
                severity: node_1.DiagnosticSeverity.Warning,
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
    function processFunctionLike(node, isExtern) {
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
        const docSymbol = {
            name: functionName,
            kind: node_1.SymbolKind.Function,
            range: functionRange,
            selectionRange: functionRange,
            detail: isExtern ? "extern" : "function",
            children: [],
        };
        documentSymbols.push(docSymbol);
        const seenParams = new Set();
        for (const param of asArray(node.params)) {
            const paramName = asIdentifier(param.name);
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
                    severity: node_1.DiagnosticSeverity.Error,
                    range: paramRange,
                    message: `duplicate parameter '${paramName.text}' in function '${functionName}'`,
                    source: "ekzemplo2-ls",
                });
            }
            seenParams.add(paramName.text);
        }
        if (!isExtern) {
            processStatement(node.body ?? undefined, functionName, docSymbol);
        }
    }
    function processStatement(statement, currentFunction, functionSymbol) {
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
                    processExpression(statement.initializer);
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
                        kind: node_1.SymbolKind.Variable,
                        range: variableRange,
                        selectionRange: variableRange,
                    });
                }
                processExpression(statement.initializer);
                return;
            }
            case "AssignStmt": {
                processAssignTarget(statement.target);
                processExpression(statement.value);
                return;
            }
            case "ExprStmt":
                processExpression(statement.value);
                return;
            case "IfStmt":
                processExpression(statement.condition);
                processStatement(statement.thenBranch, currentFunction, functionSymbol);
                processStatement(statement.elseBranch, currentFunction, functionSymbol);
                return;
            case "ForStmt":
                processStatement(statement.init, currentFunction, functionSymbol);
                processExpression(statement.condition);
                processStatement(statement.update, currentFunction, functionSymbol);
                processStatement(statement.body, currentFunction, functionSymbol);
                return;
            case "WhileStmt":
                processExpression(statement.condition);
                processStatement(statement.body, currentFunction, functionSymbol);
                return;
            case "ReturnStmt":
                processExpression(statement.value);
                return;
            default:
                return;
        }
    }
    function processAssignTarget(target) {
        if (!target || typeof target.kind !== "string") {
            return;
        }
        if (target.kind === "Identifier") {
            processIdentifierReference(asIdentifier(target), "variable");
            return;
        }
        if (target.kind === "IndexExpr") {
            processIdentifierReference(asIdentifier(target.array), "variable");
            processExpression(target.index);
        }
    }
    function processExpression(expr) {
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
                processExpression(expr.index);
                return;
            case "BinaryExpr":
                processExpression(expr.left);
                processExpression(expr.right);
                return;
            case "CastExpr":
                processExpression(expr.value);
                return;
            default:
                return;
        }
    }
    function processIdentifierReference(identifier, tokenType) {
        const range = rangeFromIdentifier(identifier);
        if (!identifier || !range) {
            return;
        }
        if (languageData_1.KEYWORDS.has(identifier.text) || languageData_1.TYPE_NAMES.has(identifier.text)) {
            return;
        }
        upsertTokenFromIdentifier(identifier, tokenType);
        pushReference(identifier.text, range);
    }
    function upsertTokenFromIdentifier(identifier, type) {
        if (!identifier?.loc || identifier.text.length <= 0) {
            return;
        }
        const line = Math.max(0, identifier.loc.line - 1);
        const start = Math.max(0, identifier.loc.column);
        upsertToken({ line, start, length: identifier.text.length, type });
    }
    function rangeFromIdentifier(identifier) {
        if (!identifier?.loc || identifier.text.length <= 0) {
            return null;
        }
        const line = Math.max(0, identifier.loc.line - 1);
        const start = Math.max(0, identifier.loc.column);
        return (0, lspUtils_1.createRange)(line, start, identifier.text.length);
    }
};
exports.buildIndex = buildIndex;
const asArray = (value) => {
    return Array.isArray(value) ? value : [];
};
const asIdentifier = (value) => {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const candidate = value;
    if (candidate.kind !== "Identifier" || typeof candidate.text !== "string") {
        return undefined;
    }
    return candidate;
};
//# sourceMappingURL=lspIndexer.js.map