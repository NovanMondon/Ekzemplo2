import type { Statement, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerAssignStatement } from "./assignStmt.js";
import { lowerExprStatement } from "./exprStmt.js";
import { lowerReturnStatement } from "./returnStmt.js";
import { lowerVarDeclStatement } from "./varDeclStmt.js";

export type LoweredStatements = {
	code: string;
	terminated: boolean;
};

export const lowerStatements = (
	statements: Statement[],
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	let code = "";
	let terminated = false;

	for (const stmt of statements) {
		if (terminated) {
			throw new Error("statements after return are not allowed");
		}

		if (stmt.kind === "ReturnStmt") {
			code += lowerReturnStatement(stmt, returnType, ctx);
			terminated = true;
			continue;
		}

		if (stmt.kind === "Block") {
			ctx.scopes.push(new Map());
			const nested = lowerStatements(stmt.statements, returnType, ctx);
			ctx.scopes.pop();
			code += nested.code;
			terminated = nested.terminated;
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

	return { code, terminated };
};
