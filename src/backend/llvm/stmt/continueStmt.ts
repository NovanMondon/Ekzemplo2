import type { ContinueStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";

export const lowerContinueStatement = (_stmt: ContinueStmt, ctx: FunctionEmitContext): string => {
	const target = ctx.loopTargets[ctx.loopTargets.length - 1]!;
	return `  br label %${target.continueLabel}\n`;
};
