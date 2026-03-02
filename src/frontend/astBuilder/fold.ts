import * as antlr from "antlr4ng";

import type { Expr } from "../ast.js";
import type { AstBuilder } from "./builder.js";
import { withLoc } from "./location.js";
import { expectExprResult } from "./types.js";

type BinaryOp = "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";

export const foldBinaryExprs = (
	parts: antlr.ParserRuleContext[],
	visitor: AstBuilder,
	validOps: BinaryOp[],
	ctx: antlr.ParserRuleContext,
	sourceName: string,
): Expr => {
	if (parts.length === 0) {
		throw new Error("internal error: expected at least one expression part");
	}
	let acc = expectExprResult(parts[0]!.accept(visitor));

	const ops = collectOps(parts[0]!, validOps);
	if (ops.length !== parts.length - 1) {
		throw new Error("internal error: operator/operand count mismatch");
	}

	for (let i = 1; i < parts.length; i++) {
		const right = expectExprResult(parts[i]!.accept(visitor));
		acc = withLoc({ kind: "BinaryExpr", op: ops[i - 1]!, left: acc, right }, ctx, sourceName);
	}

	return acc;
};

const collectOps = (firstPart: antlr.ParserRuleContext, validOps: BinaryOp[]): BinaryOp[] => {
	const parent = firstPart.parent;
	if (!parent || !parent.children) {
		return [];
	}
	const ops: BinaryOp[] = [];
	for (const child of parent.children) {
		const text = child.getText?.();
		if (text && validOps.includes(text as BinaryOp)) {
			ops.push(text as BinaryOp);
		}
	}
	return ops;
};
