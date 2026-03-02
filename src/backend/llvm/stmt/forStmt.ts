import type { ForStmt, Statement, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { lowerExprToLlvm } from "../expr.js";
import { lowerStatements } from "./lowerStatements.js";

export const lowerForStatement = (
	stmt: ForStmt,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
): string => {
	const condLabel = ctx.nextLabel("for.cond");
	const bodyLabel = ctx.nextLabel("for.body");
	const updateLabel = ctx.nextLabel("for.update");
	const endLabel = ctx.nextLabel("for.end");

	ctx.scopes.push(new Map());

	let code = "";
	if (stmt.init) {
		const loweredInit = lowerSingleStatement(stmt.init, returnType, ctx);
		code += loweredInit.code;
	}

	code += `  br label %${condLabel}\n`;
	code += `${condLabel}:\n`;
	if (stmt.condition) {
		const condition = lowerExprToLlvm(stmt.condition, ctx);
		code += condition.code;
		code += `  br i1 ${condition.value}, label %${bodyLabel}, label %${endLabel}\n`;
	} else {
		code += `  br label %${bodyLabel}\n`;
	}

	code += `${bodyLabel}:\n`;
	ctx.loopTargets.push({ breakLabel: endLabel, continueLabel: updateLabel });
	const loweredBody = lowerSingleStatement(stmt.body, returnType, ctx);
	ctx.loopTargets.pop();
	code += loweredBody.code;
	if (loweredBody.exit === "none") {
		code += `  br label %${updateLabel}\n`;
	}

	code += `${updateLabel}:\n`;
	if (stmt.update) {
		const loweredUpdate = lowerSingleStatement(stmt.update, returnType, ctx);
		code += loweredUpdate.code;
	}
	code += `  br label %${condLabel}\n`;
	code += `${endLabel}:\n`;

	ctx.scopes.pop();
	return code;
};

const lowerSingleStatement = (
	statement: Statement,
	returnType: TypeNode,
	ctx: FunctionEmitContext,
) => {
	return lowerStatements([statement], returnType, ctx);
};
