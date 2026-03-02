import type { ContinueStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";

export const lowerContinueStatement = (_stmt: ContinueStmt, ctx: FunctionEmitContext): string => {
	const target = ctx.loopTargets[ctx.loopTargets.length - 1];
	if (!target) {
		throw new Error("continue statement not within loop");
	}
	return `  br label %${target.continueLabel}\n`;
};
