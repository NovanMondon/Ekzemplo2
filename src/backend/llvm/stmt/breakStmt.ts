import type { BreakStmt } from "../../../frontend/ast.js";
import { semanticError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";

export const lowerBreakStatement = (_stmt: BreakStmt, ctx: FunctionEmitContext): string => {
	const target = ctx.loopTargets[ctx.loopTargets.length - 1];
	if (!target) {
		throw semanticError("break statement not within loop", _stmt);
	}
	return `  br label %${target.breakLabel}\n`;
};
