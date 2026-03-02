import type { CallExpr } from "../../../frontend/ast.js";
import { semanticError, typeError } from "../../../diagnostics/compileDiagnostic.js";
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
		throw semanticError(`undefined function: ${expr.callee.text}`, expr.callee);
	}
	const fixedParamCount = signature.params.length;
	if (
		(!signature.isVariadic && fixedParamCount !== expr.args.length) ||
		(signature.isVariadic && expr.args.length < fixedParamCount)
	) {
		const expected = signature.isVariadic ? `at least ${fixedParamCount}` : String(fixedParamCount);
		throw semanticError(
			`argument count mismatch for ${expr.callee.text}: expected ${expected}, got ${expr.args.length}`,
			expr,
		);
	}

	let code = "";
	const loweredArgs: string[] = [];
	for (let i = 0; i < expr.args.length; i++) {
		const lowered = lowerExpr(expr.args[i]!, ctx);
		const expectedType = signature.params[i];
		if (expectedType) {
			if (!isSameType(lowered.type, expectedType)) {
				throw typeError(
					`argument type mismatch for ${expr.callee.text} at ${i + 1}: expected ${typeToString(expectedType)}, got ${typeToString(lowered.type)}`,
					expr.args[i],
				);
			}
		}
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
