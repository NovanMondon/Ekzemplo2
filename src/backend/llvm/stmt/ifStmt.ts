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
		if (!loweredThen.terminated) {
			code += `  br label %${endLabel}\n`;
		}
		code += `${endLabel}:\n`;
		return { code, terminated: false };
	}

	const elseLabel = ctx.nextLabel("if.else");
	const loweredElse = lowerSingleStatement(stmt.elseBranch, returnType, ctx);
	const terminated = loweredThen.terminated && loweredElse.terminated;
	const endLabel = terminated ? null : ctx.nextLabel("if.end");

	let code = "";
	code += condition.code;
	code += `  br i1 ${condition.value}, label %${thenLabel}, label %${elseLabel}\n`;
	code += `${thenLabel}:\n`;
	code += loweredThen.code;
	if (endLabel && !loweredThen.terminated) {
		code += `  br label %${endLabel}\n`;
	}
	code += `${elseLabel}:\n`;
	code += loweredElse.code;
	if (endLabel && !loweredElse.terminated) {
		code += `  br label %${endLabel}\n`;
	}
	if (endLabel) {
		code += `${endLabel}:\n`;
	}

	return { code, terminated };
};

const lowerSingleStatement = (
	statement: Statement,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): LoweredStatements => {
	return lowerStatements([statement], returnType, ctx);
};
