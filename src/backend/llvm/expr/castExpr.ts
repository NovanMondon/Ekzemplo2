import type { CastExpr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { boolType, intType, isSameType, type LowerExprFn, type LoweredExpr } from "./shared.js";

export const lowerCastExpr = (
	expr: CastExpr,
	ctx: FunctionEmitContext,
	lowerExpr: LowerExprFn,
): LoweredExpr => {
	const inner = lowerExpr(expr.value, ctx);
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
	throw new Error("internal error: unsupported cast combination reached after typecheck");
};
