import type { BinaryExpr } from "../../../frontend/ast.js";
import { semanticError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { boolType, intType, llvmTypeFor, type LowerExprFn, type LoweredExpr } from "./shared.js";

export const lowerBinaryExpr = (
	expr: BinaryExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const left = lowerExpr(expr.left, ctx);
	const right = lowerExpr(expr.right, ctx);
	const tmp = ctx.nextTemp();
	const op = expr.op;
	if (op === "+" || op === "-" || op === "*" || op === "/") {
		const instr = op === "+" ? "add" : op === "-" ? "sub" : op === "*" ? "mul" : "sdiv";
		return {
			code: left.code + right.code + `  ${tmp} = ${instr} i32 ${left.value}, ${right.value}\n`,
			value: tmp,
			type: intType,
		};
	}
	const isEquality = op === "==" || op === "!=";
	const isRelational = op === "<" || op === "<=" || op === ">" || op === ">=";
	if (!isEquality && !isRelational) {
		throw semanticError(`unsupported binary op: ${expr.op}`, expr);
	}
	const llvmType = llvmTypeFor(left.type);
	const cond =
		op === "=="
			? "eq"
			: op === "!="
				? "ne"
				: op === "<"
					? "slt"
					: op === "<="
						? "sle"
						: op === ">"
							? "sgt"
							: "sge";
	return {
		code:
			left.code +
			right.code +
			`  ${tmp} = icmp ${cond} ${llvmType} ${left.value}, ${right.value}\n`,
		value: tmp,
		type: boolType,
	};
};
