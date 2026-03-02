import type { BinaryExpr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import {
	boolType,
	intType,
	isSameType,
	llvmTypeFor,
	type LowerExprFn,
	type LoweredExpr,
} from "./shared.js";

export const lowerBinaryExpr = (
	expr: BinaryExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const left = lowerExpr(expr.left, ctx);
	const right = lowerExpr(expr.right, ctx);
	if (left.type.kind === "ArrayType" || right.type.kind === "ArrayType") {
		throw new Error(`binary op ${expr.op} does not support array operands`);
	}
	if (
		left.type.kind === "StringType" ||
		right.type.kind === "StringType" ||
		left.type.kind === "CharType" ||
		right.type.kind === "CharType"
	) {
		throw new Error(`binary op ${expr.op} does not support string/char operands`);
	}
	const tmp = ctx.nextTemp();
	const op = expr.op;
	if (op === "+" || op === "-" || op === "*" || op === "/") {
		if (left.type.kind !== "IntType" || right.type.kind !== "IntType") {
			throw new Error(`binary op ${op} expects int operands`);
		}
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
		throw new Error(`unsupported binary op: ${expr.op}`);
	}
	if (isRelational && (left.type.kind !== "IntType" || right.type.kind !== "IntType")) {
		throw new Error(`binary op ${op} expects int operands`);
	}
	if (isEquality && !isSameType(left.type, right.type)) {
		throw new Error(`binary op ${op} expects matching operand types`);
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
