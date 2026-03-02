import type { IndexExpr } from "../../../frontend/ast.js";
import { semanticError, typeError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { resolveVariable } from "../scope.js";
import { charType, llvmTypeFor, type LowerExprFn, type LoweredExpr } from "./shared.js";

export const lowerIndexExpr = (
	expr: IndexExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const binding = resolveVariable(ctx, expr.array.text);
	if (!binding) {
		throw semanticError(`undefined variable: ${expr.array.text} (in ${ctx.sourceFilename})`, expr.array);
	}
	if (binding.type.kind !== "ArrayType" && binding.type.kind !== "StringType") {
		throw semanticError(`index access requires array variable: ${expr.array.text}`, expr);
	}

	const loweredIndex = lowerExpr(expr.index, ctx);
	if (loweredIndex.type.kind !== "IntType") {
		throw typeError(`array index must be int: ${expr.array.text}`, expr.index);
	}

	const elementType = binding.type.kind === "ArrayType" ? binding.type.elementType : charType;
	const arrayType = binding.type.kind === "ArrayType" ? llvmTypeFor(binding.type) : "i8";
	const elementLlvmType = llvmTypeFor(elementType);
	const elementPtr = ctx.nextTemp();
	const loaded = ctx.nextTemp();
	const baseStringPtr = ctx.nextTemp();
	const gep =
		binding.type.kind === "ArrayType"
			? `  ${elementPtr} = getelementptr inbounds ${arrayType}, ${arrayType}* ${binding.pointer}, i32 0, i32 ${loweredIndex.value}\n`
			: `  ${baseStringPtr} = load i8*, i8** ${binding.pointer}\n  ${elementPtr} = getelementptr inbounds i8, i8* ${baseStringPtr}, i32 ${loweredIndex.value}\n`;
	return {
		code:
			loweredIndex.code +
			gep +
			`  ${loaded} = load ${elementLlvmType}, ${elementLlvmType}* ${elementPtr}\n`,
		value: loaded,
		type: elementType,
	};
};
