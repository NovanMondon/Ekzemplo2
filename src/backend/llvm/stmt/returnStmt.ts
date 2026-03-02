import type { ReturnStmt, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm, llvmTypeFor } from "../expr.js";

export const lowerReturnStatement = (
	stmt: ReturnStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): string => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	return `${lowered.code}  ret ${llvmTypeFor(returnType)} ${lowered.value}\n`;
};
