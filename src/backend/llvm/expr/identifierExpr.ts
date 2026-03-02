import type { Identifier } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { resolveVariable } from "../scope.js";
import { llvmTypeFor, type LoweredExpr } from "./shared.js";

export const lowerIdentifierExpr = (expr: Identifier, ctx: FunctionEmitContext): LoweredExpr => {
	const binding = resolveVariable(ctx, expr.text);
	if (!binding) {
		throw new Error(`undefined variable: ${expr.text} (in ${ctx.sourceFilename})`);
	}
	if (binding.type.kind === "ArrayType") {
		throw new Error(`array variable requires index access: ${expr.text}`);
	}
	const tmp = ctx.nextTemp();
	const llvmType = llvmTypeFor(binding.type);
	return {
		code: `  ${tmp} = load ${llvmType}, ${llvmType}* ${binding.pointer}\n`,
		value: tmp,
		type: binding.type,
	};
};
