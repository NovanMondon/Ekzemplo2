import type { Expr } from "../ast.js";
import type { FunctionEmitContext } from "./env.js";

export type LoweredExpr = {
	lines: string[];
	value: string;
};

export const lowerExprToLlvm = (expr: Expr, ctx: FunctionEmitContext): LoweredExpr => {
	switch (expr.kind) {
		case "IntLiteral":
			return { lines: [], value: String(expr.value) };
		case "BinaryExpr": {
			if (expr.op !== "+") {
				throw new Error(`unsupported binary op: ${expr.op}`);
			}
			const left = lowerExprToLlvm(expr.left, ctx);
			const right = lowerExprToLlvm(expr.right, ctx);
			const tmp = ctx.nextTemp();
			return {
				lines: [...left.lines, ...right.lines, `  ${tmp} = add i32 ${left.value}, ${right.value}`],
				value: tmp,
			};
		}
		case "Identifier":
			throw new Error(
				`identifiers are not supported in expressions yet (in ${ctx.sourceFilename})`,
			);
		default: {
			const _exhaustive: never = expr;
			return _exhaustive;
		}
	}
};
