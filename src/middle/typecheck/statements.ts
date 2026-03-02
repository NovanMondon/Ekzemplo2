import type { AssignStmt, ForStmt, Statement, TypeNode } from "../../frontend/ast.js";
import { semanticError, typeError } from "../../diagnostics/compileDiagnostic.js";
import { typecheckExpr } from "./expr.js";
import { currentScope, resolveVariable } from "./scope.js";
import type { ExitKind, TypecheckContext } from "./types.js";
import { isSameType, typeToString } from "./typeUtils.js";

export const typecheckStatements = (
	statements: Statement[],
	returnType: TypeNode,
	ctx: TypecheckContext,
): ExitKind => {
	let exit: ExitKind = "none";

	for (const stmt of statements) {
		if (exit !== "none") {
			throw semanticError("statements after terminating statement are not allowed", stmt);
		}

		switch (stmt.kind) {
			case "ReturnStmt": {
				const valueType = typecheckExpr(stmt.value, ctx);
				if (!isSameType(valueType, returnType)) {
					throw typeError(
						`return type mismatch: expected ${typeToString(returnType)}, got ${typeToString(valueType)}`,
						stmt.value,
					);
				}
				exit = "return";
				break;
			}
			case "BreakStmt": {
				if (ctx.loopDepth <= 0) {
					throw semanticError("break statement not within loop", stmt);
				}
				exit = "break";
				break;
			}
			case "ContinueStmt": {
				if (ctx.loopDepth <= 0) {
					throw semanticError("continue statement not within loop", stmt);
				}
				exit = "continue";
				break;
			}
			case "Block": {
				exit = typecheckBlock(stmt.statements, returnType, ctx);
				break;
			}
			case "IfStmt": {
				const conditionType = typecheckExpr(stmt.condition, ctx);
				if (conditionType.kind !== "BoolType") {
					throw typeError("if condition must be bool", stmt.condition);
				}
				const thenExit = typecheckSingleStatement(stmt.thenBranch, returnType, ctx);
				if (!stmt.elseBranch) {
					exit = "none";
					break;
				}
				const elseExit = typecheckSingleStatement(stmt.elseBranch, returnType, ctx);
				exit = mergeBranchExit(thenExit, elseExit);
				break;
			}
			case "ForStmt": {
				typecheckForStatement(stmt, returnType, ctx);
				break;
			}
			case "WhileStmt": {
				const conditionType = typecheckExpr(stmt.condition, ctx);
				if (conditionType.kind !== "BoolType") {
					throw typeError("while condition must be bool", stmt.condition);
				}
				ctx.loopDepth++;
				typecheckSingleStatement(stmt.body, returnType, ctx);
				ctx.loopDepth--;
				break;
			}
			case "VarDeclStmt": {
				typecheckVarDecl(stmt, ctx);
				break;
			}
			case "AssignStmt": {
				typecheckAssign(stmt, ctx);
				break;
			}
			case "ExprStmt": {
				typecheckExpr(stmt.value, ctx);
				break;
			}
		}
	}

	return exit;
};

const typecheckForStatement = (stmt: ForStmt, returnType: TypeNode, ctx: TypecheckContext): void => {
	ctx.scopes.push(new Map());

	if (stmt.init) {
		const initExit = typecheckSingleStatement(stmt.init, returnType, ctx);
		if (initExit !== "none") {
			throw semanticError("for initializer must not terminate control flow", stmt.init);
		}
	}

	if (stmt.condition) {
		const conditionType = typecheckExpr(stmt.condition, ctx);
		if (conditionType.kind !== "BoolType") {
			throw typeError("for condition must be bool", stmt.condition);
		}
	}

	ctx.loopDepth++;
	typecheckSingleStatement(stmt.body, returnType, ctx);
	ctx.loopDepth--;

	if (stmt.update) {
		const updateExit = typecheckSingleStatement(stmt.update, returnType, ctx);
		if (updateExit !== "none") {
			throw semanticError("for update must not terminate control flow", stmt.update);
		}
	}

	ctx.scopes.pop();
};

const typecheckBlock = (
	statements: Statement[],
	returnType: TypeNode,
	ctx: TypecheckContext,
): ExitKind => {
	ctx.scopes.push(new Map());
	const exit = typecheckStatements(statements, returnType, ctx);
	ctx.scopes.pop();
	return exit;
};

const typecheckSingleStatement = (
	statement: Statement,
	returnType: TypeNode,
	ctx: TypecheckContext,
): ExitKind => {
	return typecheckStatements([statement], returnType, ctx);
};

const typecheckVarDecl = (
	stmt: Extract<Statement, { kind: "VarDeclStmt" }>,
	ctx: TypecheckContext,
): void => {
	const scope = currentScope(ctx);
	const name = stmt.name.text;
	if (scope.has(name)) {
		throw semanticError(`duplicate variable declaration: ${name}`, stmt);
	}
	if (stmt.type.kind === "ArrayType" && stmt.initializer) {
		throw semanticError("array initializer is not supported yet", stmt.initializer);
	}
	if (stmt.initializer) {
		const initType = typecheckExpr(stmt.initializer, ctx);
		if (!isSameType(initType, stmt.type)) {
			throw typeError(
				`variable initializer type mismatch: expected ${typeToString(stmt.type)}, got ${typeToString(initType)}`,
				stmt.initializer,
			);
		}
	}
	scope.set(name, stmt.type);
};

const typecheckAssign = (stmt: AssignStmt, ctx: TypecheckContext): void => {
	if (stmt.target.kind === "Identifier") {
		const targetType = resolveVariable(ctx, stmt.target.text);
		if (!targetType) {
			throw semanticError(`undefined variable: ${stmt.target.text}`, stmt.target);
		}
		if (targetType.kind === "ArrayType") {
			throw semanticError(`array whole assignment is not supported: ${stmt.target.text}`, stmt.target);
		}
		const valueType = typecheckExpr(stmt.value, ctx);
		if (!isSameType(valueType, targetType)) {
			throw typeError(
				`assignment type mismatch: expected ${typeToString(targetType)}, got ${typeToString(valueType)}`,
				stmt.value,
			);
		}
		return;
	}

	const arrayType = resolveVariable(ctx, stmt.target.array.text);
	if (!arrayType) {
		throw semanticError(`undefined variable: ${stmt.target.array.text}`, stmt.target.array);
	}
	if (arrayType.kind === "StringType") {
		throw semanticError(
			`index assignment is not supported for string: ${stmt.target.array.text}`,
			stmt.target,
		);
	}
	if (arrayType.kind !== "ArrayType") {
		throw semanticError(
			`index assignment requires array variable: ${stmt.target.array.text}`,
			stmt.target,
		);
	}

	const indexType = typecheckExpr(stmt.target.index, ctx);
	if (indexType.kind !== "IntType") {
		throw typeError(`array index must be int: ${stmt.target.array.text}`, stmt.target.index);
	}

	const valueType = typecheckExpr(stmt.value, ctx);
	if (!isSameType(valueType, arrayType.elementType)) {
		throw typeError(
			`assignment type mismatch: expected ${typeToString(arrayType.elementType)}, got ${typeToString(valueType)}`,
			stmt.value,
		);
	}
};

const mergeBranchExit = (thenExit: ExitKind, elseExit: ExitKind): ExitKind => {
	if (thenExit === "none" || elseExit === "none") {
		return "none";
	}
	if (thenExit === elseExit) {
		return thenExit;
	}
	return "mixed";
};
