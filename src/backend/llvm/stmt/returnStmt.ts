import type { ReturnStmt, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm, llvmTypeFor, typeToString } from "../expr.js";

export const lowerReturnStatement = (
	stmt: ReturnStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): string => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	if (lowered.type.kind !== returnType.kind) {
		throw new Error(
			`return type mismatch: expected ${typeToString(returnType)}, got ${typeToString(lowered.type)}`,
		);
	}
	return `${lowered.code}  ret ${llvmTypeFor(returnType)} ${lowered.value}\n`;
};
