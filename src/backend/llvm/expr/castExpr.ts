import type { CastExpr } from "../../../frontend/ast.js";
import { semanticError, typeError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import {
	boolType,
	intType,
	isSameType,
	type LowerExprFn,
	type LoweredExpr,
	typeToString,
} from "./shared.js";

export const lowerCastExpr = (
	expr: CastExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	if (expr.targetType.kind === "ArrayType") {
		throw semanticError("cast to array type is not supported", expr);
	}
	if (expr.targetType.kind === "StringType" || expr.targetType.kind === "CharType") {
		throw semanticError("cast to string/char type is not supported", expr);
	}
	const inner = lowerExpr(expr.value, ctx);
	if (inner.type.kind === "ArrayType") {
		throw semanticError("cast from array type is not supported", expr.value);
	}
	if (inner.type.kind === "StringType" || inner.type.kind === "CharType") {
		throw semanticError("cast from string/char type is not supported", expr.value);
	}
	if (isSameType(inner.type, expr.targetType)) {
		return { code: inner.code, value: inner.value, type: expr.targetType };
	}
	if (expr.targetType.kind === "IntType" && inner.type.kind === "BoolType") {
		const tmp = ctx.nextTemp();
		return {
			code: inner.code + `  ${tmp} = zext i1 ${inner.value} to i32\n`,
			value: tmp,
			type: intType,
		};
	}
	if (expr.targetType.kind === "BoolType" && inner.type.kind === "IntType") {
		const tmp = ctx.nextTemp();
		return {
			code: inner.code + `  ${tmp} = icmp ne i32 ${inner.value}, 0\n`,
			value: tmp,
			type: boolType,
		};
	}
	throw typeError(
		`unsupported cast from ${typeToString(inner.type)} to ${typeToString(expr.targetType)}`,
		expr,
	);
};
