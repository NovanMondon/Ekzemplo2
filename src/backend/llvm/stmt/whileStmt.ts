import type { Statement, TypeNode, WhileStmt } from "../../../frontend/ast.js";
import { typeError } from "../../../diagnostics/compileDiagnostic.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm } from "../expr.js";
import { lowerStatements } from "./lowerStatements.js";

export const lowerWhileStatement = (
	stmt: WhileStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): string => {
	const condLabel = ctx.nextLabel("while.cond");
	const bodyLabel = ctx.nextLabel("while.body");
	const endLabel = ctx.nextLabel("while.end");

	let code = "";
	code += `  br label %${condLabel}\n`;
	code += `${condLabel}:\n`;
	const condition = lowerExprToLlvm(stmt.condition, ctx);
	if (condition.type.kind !== "BoolType") {
		throw typeError("while condition must be bool", stmt.condition);
	}
	code += condition.code;
	code += `  br i1 ${condition.value}, label %${bodyLabel}, label %${endLabel}\n`;
	code += `${bodyLabel}:\n`;

	ctx.loopTargets.push({ breakLabel: endLabel, continueLabel: condLabel });
	const loweredBody = lowerSingleStatement(stmt.body, returnType, ctx);
	ctx.loopTargets.pop();

	code += loweredBody.code;
	if (loweredBody.exit === "none") {
		code += `  br label %${condLabel}\n`;
	}
	code += `${endLabel}:\n`;

	return code;
};

const lowerSingleStatement = (
	statement: Statement,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
) => {
	return lowerStatements([statement], returnType, ctx);
};
