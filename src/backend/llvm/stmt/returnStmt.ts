import type { ReturnStmt, TypeNode } from "../../../frontend/ast.js";
import { typeError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { isSameType, lowerExprToLlvm, llvmTypeFor, typeToString } from "../expr.js";

export const lowerReturnStatement = (
	stmt: ReturnStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): string => {
	const lowered = lowerExprToLlvm(stmt.value, ctx);
	if (!isSameType(lowered.type, returnType)) {
		throw typeError(
			`return type mismatch: expected ${typeToString(returnType)}, got ${typeToString(lowered.type)}`,
			stmt.value,
		);
	}
	return `${lowered.code}  ret ${llvmTypeFor(returnType)} ${lowered.value}\n`;
};
