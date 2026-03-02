import type { CallExpr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { escapeLlvmIdentifier } from "../escape.js";
import { llvmTypeFor, type LowerExprFn, type LoweredExpr } from "./shared.js";

export const lowerCallExpr = (
	expr: CallExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const signature = ctx.functions.get(expr.callee.text)!;

	let code = "";
	const loweredArgs: string[] = [];
	for (let i = 0; i < expr.args.length; i++) {
		const lowered = lowerExpr(expr.args[i]!, ctx);
		const expectedType = signature.params[i];
		code += lowered.code;
		const llvmType = llvmTypeFor(expectedType ?? lowered.type);
		loweredArgs.push(`${llvmType} ${lowered.value}`);
	}

	const tmp = ctx.nextTemp();
	const returnLlvmType = llvmTypeFor(signature.returnType);
	if (signature.isVariadic) {
		const fixedParamTypes = signature.params.map((p) => llvmTypeFor(p));
		const calleeType =
			fixedParamTypes.length > 0 ? `(${fixedParamTypes.join(", ")}, ...)` : `(...)`;
		code += `  ${tmp} = call ${returnLlvmType} ${calleeType} @${escapeLlvmIdentifier(expr.callee.text)}(${loweredArgs.join(", ")})\n`;
	} else {
		code += `  ${tmp} = call ${returnLlvmType} @${escapeLlvmIdentifier(expr.callee.text)}(${loweredArgs.join(", ")})\n`;
	}
	return {
		code,
		value: tmp,
		type: signature.returnType,
	};
};
