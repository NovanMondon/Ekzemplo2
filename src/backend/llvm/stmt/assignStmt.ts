import type { AssignStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { llvmTypeFor, lowerExprToLlvm, typeToString } from "../expr.js";
import { resolveVariable } from "../scope.js";

export const lowerAssignStatement = (stmt: AssignStmt, ctx: FunctionEmitContext): string => {
	const binding = resolveVariable(ctx, stmt.target.text);
	if (!binding) {
		throw new Error(`undefined variable: ${stmt.target.text}`);
	}

	const lowered = lowerExprToLlvm(stmt.value, ctx);
	if (lowered.type.kind !== binding.type.kind) {
		throw new Error(
			`assignment type mismatch: expected ${typeToString(binding.type)}, got ${typeToString(lowered.type)}`,
		);
	}

	const llvmType = llvmTypeFor(binding.type);
	return lowered.code + `  store ${llvmType} ${lowered.value}, ${llvmType}* ${binding.pointer}\n`;
};
