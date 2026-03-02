import type { ReturnStmt } from "../../frontend/ast.js";
import type { FunctionEmitContext } from "./env.js";
import { lowerExprToLlvm } from "./expr.js";

export const lowerReturnStatement = (stmt: ReturnStmt, ctx: FunctionEmitContext): string => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	return `${lowered.code}  ret i32 ${lowered.value}\n`;
};
