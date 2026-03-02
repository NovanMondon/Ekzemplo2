import type { Expr } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerBinaryExpr } from "./binaryExpr.js";
import { lowerCallExpr } from "./callExpr.js";
import { lowerCastExpr } from "./castExpr.js";
import { lowerIdentifierExpr } from "./identifierExpr.js";
import { lowerIndexExpr } from "./indexExpr.js";
import {
	lowerBoolLiteralExpr,
	lowerCharLiteralExpr,
	lowerIntLiteralExpr,
	lowerStringLiteralExpr,
} from "./literalExpr.js";
import type { LoweredExpr } from "./shared.js";

export const lowerExprToLlvm = (expr: Expr, ctx: FunctionEmitContext): LoweredExpr => {
	switch (expr.kind) {
		case "IntLiteral":
			return lowerIntLiteralExpr(expr);
		case "StringLiteral":
			return lowerStringLiteralExpr(expr, ctx);
		case "CharLiteral":
			return lowerCharLiteralExpr(expr);
		case "BoolLiteral":
			return lowerBoolLiteralExpr(expr);
		case "CastExpr":
			return lowerCastExpr(expr, ctx, lowerExprToLlvm);
		case "BinaryExpr":
			return lowerBinaryExpr(expr, ctx, lowerExprToLlvm);
		case "Identifier":
			return lowerIdentifierExpr(expr, ctx);
		case "IndexExpr":
			return lowerIndexExpr(expr, ctx, lowerExprToLlvm);
		case "CallExpr":
			return lowerCallExpr(expr, ctx, lowerExprToLlvm);
		default: {
			const _exhaustive: never = expr;
			return _exhaustive;
		}
	}
};
