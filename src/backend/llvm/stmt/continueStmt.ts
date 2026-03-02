import type { ContinueStmt } from "../../../frontend/ast.js";
import { semanticError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";

export const lowerContinueStatement = (_stmt: ContinueStmt, ctx: FunctionEmitContext): string => {
	const target = ctx.loopTargets[ctx.loopTargets.length - 1];
	if (!target) {
		throw semanticError("continue statement not within loop", _stmt);
	}
	return `  br label %${target.continueLabel}\n`;
};
