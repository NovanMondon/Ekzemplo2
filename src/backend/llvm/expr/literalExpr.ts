import type { BoolLiteral, CharLiteral, IntLiteral, StringLiteral } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { boolType, charType, intType, stringType, type LoweredExpr } from "./shared.js";

export const lowerIntLiteralExpr = (expr: IntLiteral): LoweredExpr => {
	return { code: "", value: String(expr.value), type: intType };
};

export const lowerBoolLiteralExpr = (expr: BoolLiteral): LoweredExpr => {
	return { code: "", value: expr.value ? "1" : "0", type: boolType };
};

export const lowerCharLiteralExpr = (expr: CharLiteral): LoweredExpr => {
	return { code: "", value: String(expr.value), type: charType };
};

export const lowerStringLiteralExpr = (
	expr: StringLiteral,
	ctx: FunctionEmitContext,
): LoweredExpr => {
	const existing = ctx.stringLiteralPool.get(expr.raw);
	const pooled = existing ?? registerStringLiteral(expr, ctx);
	const ptrTemp = ctx.nextTemp();
	const code = `  ${ptrTemp} = getelementptr inbounds ${pooled.llvmType}, ${pooled.llvmType}* @${pooled.globalName}, i32 0, i32 0\n`;
	return {
		code,
		value: ptrTemp,
		type: stringType,
	};
};

const registerStringLiteral = (
	expr: StringLiteral,
	ctx: FunctionEmitContext,
): { globalName: string; llvmType: string } => {
	const bytes = [...expr.bytes, 0];
	const llvmType = `[${bytes.length} x i8]`;
	const globalName = ctx.nextStringLiteralGlobal();
	const initializer = bytesToLlvmCStyle(bytes);
	ctx.globalDefinitions.push(
		`@${globalName} = private unnamed_addr constant ${llvmType} c"${initializer}", align 1`,
	);
	const pooled = { globalName, llvmType };
	ctx.stringLiteralPool.set(expr.raw, pooled);
	return pooled;
};

const bytesToLlvmCStyle = (bytes: number[]): string => {
	let out = "";
	for (const value of bytes) {
		if (value >= 0x20 && value <= 0x7e && value !== 0x22 && value !== 0x5c) {
			out += String.fromCharCode(value);
			continue;
		}
		out += `\\${value.toString(16).toUpperCase().padStart(2, "0")}`;
	}
	return out;
};
