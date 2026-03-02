import type { Statement, TypeNode } from "../../../frontend/ast.js";
import { semanticError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerAssignStatement } from "./assignStmt.js";
import { lowerBreakStatement } from "./breakStmt.js";
import { lowerContinueStatement } from "./continueStmt.js";
import { lowerExprStatement } from "./exprStmt.js";
import { lowerForStatement } from "./forStmt.js";
import { lowerIfStatement } from "./ifStmt.js";
import { lowerReturnStatement } from "./returnStmt.js";
import { lowerVarDeclStatement } from "./varDeclStmt.js";
import { lowerWhileStatement } from "./whileStmt.js";

export type ExitKind = "none" | "return" | "break" | "continue" | "mixed";

export type LoweredStatements = {
	code: string;
	exit: ExitKind;
};

export const lowerStatements = (
	statements: Statement[],
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	let code = "";
	let exit: ExitKind = "none";

	for (const stmt of statements) {
		if (exit !== "none") {
			throw semanticError("statements after terminating statement are not allowed", stmt);
		}

		if (stmt.kind === "ReturnStmt") {
			code += lowerReturnStatement(stmt, returnType, ctx);
			exit = "return";
			continue;
		}

		if (stmt.kind === "BreakStmt") {
			code += lowerBreakStatement(stmt, ctx);
			exit = "break";
			continue;
		}

		if (stmt.kind === "ContinueStmt") {
			code += lowerContinueStatement(stmt, ctx);
			exit = "continue";
			continue;
		}

		if (stmt.kind === "Block") {
			const nested = lowerBlockStatements(stmt.statements, returnType, ctx);
			code += nested.code;
			exit = nested.exit;
			continue;
		}

		if (stmt.kind === "IfStmt") {
			const loweredIf = lowerIfStatement(stmt, returnType, ctx);
			code += loweredIf.code;
			exit = loweredIf.exit;
			continue;
		}

		if (stmt.kind === "ForStmt") {
			code += lowerForStatement(stmt, returnType, ctx);
			continue;
		}

		if (stmt.kind === "WhileStmt") {
			code += lowerWhileStatement(stmt, returnType, ctx);
			continue;
		}

		if (stmt.kind === "VarDeclStmt") {
			code += lowerVarDeclStatement(stmt, ctx);
			continue;
		}

		if (stmt.kind === "AssignStmt") {
			code += lowerAssignStatement(stmt, ctx);
			continue;
		}

		if (stmt.kind === "ExprStmt") {
			code += lowerExprStatement(stmt, ctx);
			continue;
		}
	}

	return { code, exit };
};

const lowerBlockStatements = (
	statements: Statement[],
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	ctx.scopes.push(new Map());
	const lowered = lowerStatements(statements, returnType, ctx);
	ctx.scopes.pop();
	return lowered;
};
