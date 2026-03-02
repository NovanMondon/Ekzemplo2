import type {
	AssignTarget,
	Block,
	Expr,
	ExternFunctionDecl,
	ForStmt,
	FunctionDecl,
	Identifier,
	Program,
	Statement,
} from "../frontend/ast.js";

type LspSymbolType = "function" | "variable" | "parameter";

type LspSeverity = "error" | "warning";

export type LspIndexDiagnostic = {
	severity: LspSeverity;
	message: string;
	line: number;
	column: number;
	length: number;
};

export type LspIndexDefinition = {
	id: string;
	name: string;
	symbolType: LspSymbolType;
	line: number;
	column: number;
	length: number;
	containerName?: string;
	detail?: string;
};

export type LspIndexReference = {
	name: string;
	symbolType: "function" | "variable";
	line: number;
	column: number;
	length: number;
	resolvedDefinitionId?: string;
};

export type LspIndexOutput = {
	definitions: LspIndexDefinition[];
	references: LspIndexReference[];
	diagnostics: LspIndexDiagnostic[];
};

type Scope = {
	bindings: Map<string, string>;
	parent?: Scope;
};

export const buildLspIndex = (program: Program): LspIndexOutput => {
	const definitions: LspIndexDefinition[] = [];
	const references: LspIndexReference[] = [];
	const diagnostics: LspIndexDiagnostic[] = [];
	const functionDefinitionIdsByName = new Map<string, string[]>();
	let nextDefinitionId = 1;

	const createDefinition = (
		identifier: Identifier,
		symbolType: LspSymbolType,
		containerName?: string,
		detail?: string,
	): string | undefined => {
		if (!identifier.loc) {
			return undefined;
		}
		const id = `def:${nextDefinitionId}`;
		nextDefinitionId += 1;
		definitions.push({
			id,
			name: identifier.text,
			symbolType,
			line: Math.max(0, identifier.loc.line - 1),
			column: Math.max(0, identifier.loc.column),
			length: Math.max(1, identifier.text.length),
			containerName,
			detail,
		});
		return id;
	};

	const createReference = (
		identifier: Identifier,
		symbolType: "function" | "variable",
		resolvedDefinitionId?: string,
	): void => {
		if (!identifier.loc) {
			return;
		}
		references.push({
			name: identifier.text,
			symbolType,
			line: Math.max(0, identifier.loc.line - 1),
			column: Math.max(0, identifier.loc.column),
			length: Math.max(1, identifier.text.length),
			resolvedDefinitionId,
		});
	};

	const createDiagnostic = (
		message: string,
		identifier: Identifier,
		severity: LspSeverity = "error",
	): void => {
		if (!identifier.loc) {
			return;
		}
		diagnostics.push({
			severity,
			message,
			line: Math.max(0, identifier.loc.line - 1),
			column: Math.max(0, identifier.loc.column),
			length: Math.max(1, identifier.text.length),
		});
	};

	const resolveVariable = (scope: Scope, name: string): string | undefined => {
		let current: Scope | undefined = scope;
		while (current) {
			const resolved = current.bindings.get(name);
			if (resolved) {
				return resolved;
			}
			current = current.parent;
		}
		return undefined;
	};

	const resolveFunction = (name: string): string | undefined => {
		const defs = functionDefinitionIdsByName.get(name);
		return defs?.[0];
	};

	const defineFunction = (fn: ExternFunctionDecl | FunctionDecl, isExtern: boolean): void => {
		const defId = createDefinition(
			fn.name,
			"function",
			undefined,
			isExtern ? `extern function ${fn.name.text}` : `function ${fn.name.text}`,
		);
		if (!defId) {
			return;
		}
		const defs = functionDefinitionIdsByName.get(fn.name.text) ?? [];
		if (defs.length > 0) {
			createDiagnostic(`duplicate function declaration '${fn.name.text}'`, fn.name);
		}
		defs.push(defId);
		functionDefinitionIdsByName.set(fn.name.text, defs);
	};

	const defineVariable = (
		scope: Scope,
		identifier: Identifier,
		symbolType: "variable" | "parameter",
		containerName: string,
	): void => {
		if (scope.bindings.has(identifier.text)) {
			createDiagnostic(`duplicate declaration '${identifier.text}'`, identifier);
			return;
		}
		const defId = createDefinition(
			identifier,
			symbolType,
			containerName,
			symbolType === "parameter" ? `${containerName} parameter` : undefined,
		);
		if (!defId) {
			return;
		}
		scope.bindings.set(identifier.text, defId);
	};

	const processAssignTarget = (target: AssignTarget, scope: Scope): void => {
		if (target.kind === "Identifier") {
			const resolved = resolveVariable(scope, target.text);
			createReference(target, "variable", resolved);
			if (!resolved) {
				createDiagnostic(`undefined variable '${target.text}'`, target);
			}
			return;
		}

		const arrayResolved = resolveVariable(scope, target.array.text);
		createReference(target.array, "variable", arrayResolved);
		if (!arrayResolved) {
			createDiagnostic(`undefined variable '${target.array.text}'`, target.array);
		}
		processExpr(target.index, scope);
	};

	const processExpr = (expr: Expr, scope: Scope): void => {
		switch (expr.kind) {
			case "Identifier": {
				const resolved = resolveVariable(scope, expr.text);
				createReference(expr, "variable", resolved);
				if (!resolved) {
					createDiagnostic(`undefined variable '${expr.text}'`, expr);
				}
				return;
			}
			case "CallExpr": {
				const resolved = resolveFunction(expr.callee.text);
				createReference(expr.callee, "function", resolved);
				if (!resolved) {
					createDiagnostic(
						`call to undefined function '${expr.callee.text}'`,
						expr.callee,
						"warning",
					);
				}
				for (const arg of expr.args) {
					processExpr(arg, scope);
				}
				return;
			}
			case "IndexExpr": {
				const resolved = resolveVariable(scope, expr.array.text);
				createReference(expr.array, "variable", resolved);
				if (!resolved) {
					createDiagnostic(`undefined variable '${expr.array.text}'`, expr.array);
				}
				processExpr(expr.index, scope);
				return;
			}
			case "BinaryExpr":
				processExpr(expr.left, scope);
				processExpr(expr.right, scope);
				return;
			case "CastExpr":
				processExpr(expr.value, scope);
				return;
			case "IntLiteral":
			case "StringLiteral":
			case "CharLiteral":
			case "BoolLiteral":
				return;
		}
	};

	const processBlock = (block: Block, parentScope: Scope, containerName: string): void => {
		const blockScope: Scope = { bindings: new Map(), parent: parentScope };
		for (const statement of block.statements) {
			processStatement(statement, blockScope, containerName);
		}
	};

	const processFor = (statement: ForStmt, parentScope: Scope, containerName: string): void => {
		const forScope: Scope = { bindings: new Map(), parent: parentScope };
		if (statement.init) {
			processStatement(statement.init, forScope, containerName);
		}
		if (statement.condition) {
			processExpr(statement.condition, forScope);
		}
		processStatement(statement.body, forScope, containerName);
		if (statement.update) {
			processStatement(statement.update, forScope, containerName);
		}
	};

	const processStatement = (statement: Statement, scope: Scope, containerName: string): void => {
		switch (statement.kind) {
			case "Block":
				processBlock(statement, scope, containerName);
				return;
			case "VarDeclStmt":
				defineVariable(scope, statement.name, "variable", containerName);
				if (statement.initializer) {
					processExpr(statement.initializer, scope);
				}
				return;
			case "AssignStmt":
				processAssignTarget(statement.target, scope);
				processExpr(statement.value, scope);
				return;
			case "ExprStmt":
				processExpr(statement.value, scope);
				return;
			case "IfStmt":
				processExpr(statement.condition, scope);
				processStatement(statement.thenBranch, scope, containerName);
				if (statement.elseBranch) {
					processStatement(statement.elseBranch, scope, containerName);
				}
				return;
			case "ForStmt":
				processFor(statement, scope, containerName);
				return;
			case "WhileStmt":
				processExpr(statement.condition, scope);
				processStatement(statement.body, scope, containerName);
				return;
			case "ReturnStmt":
				processExpr(statement.value, scope);
				return;
			case "BreakStmt":
			case "ContinueStmt":
				return;
		}
	};

	for (const externFn of program.externs) {
		defineFunction(externFn, true);
	}
	for (const fn of program.functions) {
		defineFunction(fn, false);
	}

	for (const fn of program.functions) {
		const functionScope: Scope = { bindings: new Map() };
		for (const param of fn.params) {
			defineVariable(functionScope, param.name, "parameter", fn.name.text);
		}
		processStatement(fn.body, functionScope, fn.name.text);
	}

	return { definitions, references, diagnostics };
};
