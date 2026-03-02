import type { IfStmt, Statement, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm } from "../expr.js";
import { lowerStatements } from "./lowerStatements.js";
import type { LoweredStatements } from "./lowerStatements.js";

export const lowerIfStatement = (
	stmt: IfStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	const condition = lowerExprToLlvm(stmt.condition, ctx);
	if (condition.type.kind !== "BoolType") {
		throw new Error("if condition must be bool");
	}

	const thenLabel = ctx.nextLabel("if.then");
	const loweredThen = lowerSingleStatement(stmt.thenBranch, returnType, ctx);

	if (!stmt.elseBranch) {
		const endLabel = ctx.nextLabel("if.end");

		let code = "";
		code += condition.code;
		code += `  br i1 ${condition.value}, label %${thenLabel}, label %${endLabel}\n`;
		code += `${thenLabel}:\n`;
		code += loweredThen.code;
		if (loweredThen.exit === "none") {
			code += `  br label %${endLabel}\n`;
		}
		code += `${endLabel}:\n`;
		return { code, exit: "none" };
	}

	const elseLabel = ctx.nextLabel("if.else");
	const loweredElse = lowerSingleStatement(stmt.elseBranch, returnType, ctx);
	const exit = mergeBranchExit(loweredThen.exit, loweredElse.exit);
	const endLabel = exit === "none" ? ctx.nextLabel("if.end") : null;

	let code = "";
	code += condition.code;
	code += `  br i1 ${condition.value}, label %${thenLabel}, label %${elseLabel}\n`;
	code += `${thenLabel}:\n`;
	code += loweredThen.code;
	if (endLabel && loweredThen.exit === "none") {
		code += `  br label %${endLabel}\n`;
	}
	code += `${elseLabel}:\n`;
	code += loweredElse.code;
	if (endLabel && loweredElse.exit === "none") {
		code += `  br label %${endLabel}\n`;
	}
	if (endLabel) {
		code += `${endLabel}:\n`;
	}

	return { code, exit };
};

const lowerSingleStatement = (
	statement: Statement,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	return lowerStatements([statement], returnType, ctx);
};

const mergeBranchExit = (
	thenExit: LoweredStatements["exit"],
	elseExit: LoweredStatements["exit"],
) => {
	if (thenExit === "none" || elseExit === "none") {
		return "none" as const;
	}
	if (thenExit === elseExit) {
		return thenExit;
	}
	return "mixed" as const;
};
