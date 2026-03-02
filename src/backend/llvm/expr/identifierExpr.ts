import type { Identifier } from "../../../frontend/ast.js";
import { semanticError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { resolveVariable } from "../scope.js";
import { llvmTypeFor, type LoweredExpr } from "./shared.js";

export const lowerIdentifierExpr = (expr: Identifier, ctx: FunctionEmitContext): LoweredExpr => {
	const binding = resolveVariable(ctx, expr.text);
	if (!binding) {
		throw semanticError(`undefined variable: ${expr.text} (in ${ctx.sourceFilename})`, expr);
	}
	if (binding.type.kind === "ArrayType") {
		throw semanticError(`array variable requires index access: ${expr.text}`, expr);
	}
	const tmp = ctx.nextTemp();
	const llvmType = llvmTypeFor(binding.type);
	return {
		code: `  ${tmp} = load ${llvmType}, ${llvmType}* ${binding.pointer}\n`,
		value: tmp,
		type: binding.type,
	};
};
