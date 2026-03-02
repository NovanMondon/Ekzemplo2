import type * as antlr from "antlr4ng";

import type { AssignStmt, Expr, Identifier } from "../ast.js";
import type {
	ArgumentListContext,
	AssignTargetContext,
	ExprContext,
	PrimaryExprContext,
} from "../generated/Ekzemplo2Parser.js";
import { withLoc } from "./location.js";
import {
	parseBoolLiteral,
	parseCharLiteral,
	parseIntLiteral,
	parseStringLiteral,
} from "./literals.js";

export type ExprBuilderOps = {
	sourceName: string;
	parseExpr: (ctx: ExprContext) => Expr;
	makeIdentifier: (token: antlr.TerminalNode) => Identifier;
};

export const buildArgumentList = (
	argumentList: ArgumentListContext,
	parseExpr: (ctx: ExprContext) => Expr,
): Expr[] => {
	const args: Expr[] = [];
	for (const argCtx of argumentList.expr()) {
		args.push(parseExpr(argCtx));
	}
	return args;
};

export const buildAssignTarget = (
	ctx: AssignTargetContext,
	ops: ExprBuilderOps,
): AssignStmt["target"] => {
	const identToken = ctx.IDENT();
	const indexCtx = ctx.expr();
	if (!indexCtx) {
		return ops.makeIdentifier(identToken);
	}
	const index = ops.parseExpr(indexCtx);
	return withLoc(
		{
			kind: "IndexExpr",
			array: ops.makeIdentifier(identToken),
			index,
		},
		ctx,
		ops.sourceName,
	);
};

export const buildPrimaryExpr = (ctx: PrimaryExprContext, ops: ExprBuilderOps): Expr => {
	const intToken = ctx.INT();
	if (intToken) {
		return parseIntLiteral(intToken, ops.sourceName);
	}
	const stringToken = ctx.STRING_LITERAL();
	if (stringToken) {
		return parseStringLiteral(stringToken, ops.sourceName);
	}
	const charToken = ctx.CHAR_LITERAL();
	if (charToken) {
		return parseCharLiteral(charToken, ops.sourceName);
	}
	const trueToken = ctx.KW_TRUE();
	if (trueToken) {
		return parseBoolLiteral(trueToken, ops.sourceName);
	}
	const falseToken = ctx.KW_FALSE();
	if (falseToken) {
		return parseBoolLiteral(falseToken, ops.sourceName);
	}
	const identToken = ctx.IDENT();
	if (identToken) {
		if (ctx.LPAREN() && ctx.RPAREN()) {
			const argumentList = ctx.argumentList();
			return withLoc(
				{
					kind: "CallExpr",
					callee: ops.makeIdentifier(identToken),
					args: argumentList ? buildArgumentList(argumentList, ops.parseExpr) : [],
				},
				ctx,
				ops.sourceName,
			);
		}
		if (ctx.LBRACK() && ctx.RBRACK()) {
			const indexCtx = ctx.expr();
			if (!indexCtx) {
				throw new Error("internal error: expected index expression");
			}
			const index = ops.parseExpr(indexCtx);
			return withLoc(
				{
					kind: "IndexExpr",
					array: ops.makeIdentifier(identToken),
					index,
				},
				ctx,
				ops.sourceName,
			);
		}
		return ops.makeIdentifier(identToken);
	}
	const inner = ctx.expr();
	if (inner) {
		return ops.parseExpr(inner);
	}
	throw new Error("internal error: invalid primaryExpr");
};
