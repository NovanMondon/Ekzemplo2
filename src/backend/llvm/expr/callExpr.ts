import type { CallExpr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { escapeLlvmIdentifier } from "../escape.js";
import {
	isSameType,
	llvmTypeFor,
	type LowerExprFn,
	type LoweredExpr,
	typeToString,
} from "./shared.js";

export const lowerCallExpr = (
	expr: CallExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const signature = ctx.functions.get(expr.callee.text);
	if (!signature) {
		throw new Error(`undefined function: ${expr.callee.text}`);
	}
	if (signature.params.length !== expr.args.length) {
		throw new Error(
			`argument count mismatch for ${expr.callee.text}: expected ${signature.params.length}, got ${expr.args.length}`,
		);
	}

	let code = "";
	const loweredArgs: string[] = [];
	for (let i = 0; i < expr.args.length; i++) {
		const lowered = lowerExpr(expr.args[i]!, ctx);
		const expectedType = signature.params[i]!;
		if (!isSameType(lowered.type, expectedType)) {
			throw new Error(
				`argument type mismatch for ${expr.callee.text} at ${i + 1}: expected ${typeToString(expectedType)}, got ${typeToString(lowered.type)}`,
			);
		}
		code += lowered.code;
		const llvmType = llvmTypeFor(expectedType);
		loweredArgs.push(`${llvmType} ${lowered.value}`);
	}

	const tmp = ctx.nextTemp();
	const returnLlvmType = llvmTypeFor(signature.returnType);
	code += `  ${tmp} = call ${returnLlvmType} @${escapeLlvmIdentifier(expr.callee.text)}(${loweredArgs.join(", ")})\n`;
	return {
		code,
		value: tmp,
		type: signature.returnType,
	};
};
