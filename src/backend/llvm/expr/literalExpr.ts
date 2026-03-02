import type { BoolLiteral, IntLiteral } from "../../../frontend/ast.js";
import { boolType, intType, type LoweredExpr } from "./shared.js";

export const lowerIntLiteralExpr = (expr: IntLiteral): LoweredExpr => {
	return { code: "", value: String(expr.value), type: intType };
};

export const lowerBoolLiteralExpr = (expr: BoolLiteral): LoweredExpr => {
	return { code: "", value: expr.value ? "1" : "0", type: boolType };
};
