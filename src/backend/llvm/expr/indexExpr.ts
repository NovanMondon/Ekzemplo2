import type { IndexExpr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { resolveVariable } from "../scope.js";
import { llvmTypeFor, type LowerExprFn, type LoweredExpr } from "./shared.js";

export const lowerIndexExpr = (
	expr: IndexExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const binding = resolveVariable(ctx, expr.array.text);
	if (!binding) {
		throw new Error(`undefined variable: ${expr.array.text} (in ${ctx.sourceFilename})`);
	}
	if (binding.type.kind !== "ArrayType") {
		throw new Error(`index access requires array variable: ${expr.array.text}`);
	}

	const loweredIndex = lowerExpr(expr.index, ctx);
	if (loweredIndex.type.kind !== "IntType") {
		throw new Error(`array index must be int: ${expr.array.text}`);
	}

	const elementType = binding.type.elementType;
	const arrayType = llvmTypeFor(binding.type);
	const elementLlvmType = llvmTypeFor(elementType);
	const elementPtr = ctx.nextTemp();
	const loaded = ctx.nextTemp();
	return {
		code:
			loweredIndex.code +
			`  ${elementPtr} = getelementptr inbounds ${arrayType}, ${arrayType}* ${binding.pointer}, i32 0, i32 ${loweredIndex.value}\n` +
			`  ${loaded} = load ${elementLlvmType}, ${elementLlvmType}* ${elementPtr}\n`,
		value: loaded,
		type: elementType,
	};
};
