import type { ReturnStmt } from "../ast.js";
import type { FunctionEmitContext } from "./env.js";
import { lowerExprToLlvm } from "./expr.js";

export const lowerReturnStatement = (stmt: ReturnStmt, ctx: FunctionEmitContext): string[] => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	return [...lowered.lines, `  ret i32 ${lowered.value}`];
};
