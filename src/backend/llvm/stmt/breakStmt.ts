import type { BreakStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";

export const lowerBreakStatement = (_stmt: BreakStmt, ctx: FunctionEmitContext): string => {
	const target = ctx.loopTargets[ctx.loopTargets.length - 1]!;
	return `  br label %${target.breakLabel}\n`;
};
