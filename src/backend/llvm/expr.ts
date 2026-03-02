import type { Expr } from "../../frontend/ast.js";
import type { FunctionEmitContext } from "./env.js";

export type LoweredExpr = {
	code: string;
	value: string;
};

export const lowerExprToLlvm = (expr: Expr, ctx: FunctionEmitContext): LoweredExpr => {
	switch (expr.kind) {
		case "IntLiteral":
			return { code: "", value: String(expr.value) };
		case "BinaryExpr": {
			const left = lowerExprToLlvm(expr.left, ctx);
			const right = lowerExprToLlvm(expr.right, ctx);
			const tmp = ctx.nextTemp();
			const op = expr.op;
			const instr =
				op === "+" ? "add" : op === "-" ? "sub" : op === "*" ? "mul" : op === "/" ? "sdiv" : null;
			if (!instr) {
				throw new Error(`unsupported binary op: ${expr.op}`);
			}
			return {
				code: left.code + right.code + `  ${tmp} = ${instr} i32 ${left.value}, ${right.value}\n`,
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
