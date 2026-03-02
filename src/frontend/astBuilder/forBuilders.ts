import type * as antlr from "antlr4ng";

import type { AssignStmt, Expr, ForStmt, Identifier, TypeNode, VarDeclStmt } from "../ast.js";
import type {
	AssignTargetContext,
	ExprContext,
	ForInitContext,
	ForUpdateContext,
	TypeNameContext,
} from "../generated/Ekzemplo2Parser.js";
import { withLoc } from "./location.js";

export type ForBuilderOps = {
	sourceName: string;
	parseExpr: (ctx: ExprContext) => Expr;
	parseType: (ctx: TypeNameContext) => TypeNode;
	makeIdentifier: (token: antlr.TerminalNode) => Identifier;
	makeVarDecl: (
		type: TypeNode,
		nameToken: antlr.TerminalNode,
		ctx: antlr.ParserRuleContext,
		initializer?: Expr,
	) => VarDeclStmt;
	buildAssignTarget: (ctx: AssignTargetContext) => AssignStmt["target"];
};

export const buildForInit = (ctx: ForInitContext | null, ops: ForBuilderOps): ForStmt["init"] => {
	if (!ctx) {
		return undefined;
	}
	const typeName = ctx.typeName();
	if (typeName) {
		const type = ops.parseType(typeName);
		const nameToken = ctx.IDENT();
		if (!nameToken) {
			throw new Error("internal error: expected identifier");
		}
		const initExprCtx = ctx.expr();
		if (initExprCtx) {
			const initializer = ops.parseExpr(initExprCtx);
			return ops.makeVarDecl(type, nameToken, ctx, initializer);
		}
		return ops.makeVarDecl(type, nameToken, ctx);
	}

	const targetCtx = ctx.assignTarget();
	if (targetCtx && ctx.ASSIGN()) {
		const value = ctx.expr();
		if (!value) {
			throw new Error("internal error: expected Expr");
		}
		const parsed = ops.parseExpr(value);
		return withLoc(
			{
				kind: "AssignStmt",
				target: ops.buildAssignTarget(targetCtx),
				value: parsed,
			},
			ctx,
			ops.sourceName,
		);
	}

	const exprCtx = ctx.expr();
	if (!exprCtx) {
		throw new Error("internal error: expected Expr");
	}
	const value = ops.parseExpr(exprCtx);
	return withLoc({ kind: "ExprStmt", value }, ctx, ops.sourceName);
};

export const buildForUpdate = (
	ctx: ForUpdateContext | null,
	ops: ForBuilderOps,
): ForStmt["update"] => {
	if (!ctx) {
		return undefined;
	}

	const targetCtx = ctx.assignTarget();
	if (targetCtx && ctx.ASSIGN()) {
		const value = ctx.expr();
		if (!value) {
			throw new Error("internal error: expected Expr");
		}
		const parsed = ops.parseExpr(value);
		return withLoc(
			{
				kind: "AssignStmt",
				target: ops.buildAssignTarget(targetCtx),
				value: parsed,
			},
			ctx,
			ops.sourceName,
		);
	}

	const exprCtx = ctx.expr();
	if (!exprCtx) {
		throw new Error("internal error: expected Expr");
	}
	const value = ops.parseExpr(exprCtx);
	return withLoc({ kind: "ExprStmt", value }, ctx, ops.sourceName);
};
