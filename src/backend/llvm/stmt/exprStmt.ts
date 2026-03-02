import type { ExprStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm } from "../expr.js";

export const lowerExprStatement = (stmt: ExprStmt, ctx: FunctionEmitContext): string => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	return lowered.code;
};
