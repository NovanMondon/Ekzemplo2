import type { FunctionDecl } from "../../frontend/ast.js";
import type { EmitContext, FunctionEmitContext } from "./env.js";
import { escapeLlvmIdentifier } from "./escape.js";
import { llvmTypeFor } from "./expr.js";
import { lowerReturnStatement } from "./returnStmt.js";

export const lowerMinimalFunction = (
	fn: FunctionDecl,
	ctx: EmitContext,
): { functionName: string; llvmIr: string } => {
	const returnStmt = fn.body.statements[0];
	if (!returnStmt || returnStmt.kind !== "ReturnStmt") {
		throw new Error("expected return statement");
	}
	let tempCounter = 0;
	const nextTemp = () => `%t${tempCounter++}`;
	const fnCtx: FunctionEmitContext = { ...ctx, nextTemp };
	const functionName = fn.name.text;
	const body = lowerReturnStatement(returnStmt, fn.returnType, fnCtx);
	const returnLlvmType = llvmTypeFor(fn.returnType);
	return {
		functionName,
		llvmIr:
			`define ${returnLlvmType} @${escapeLlvmIdentifier(functionName)}() {\n` +
			"entry:\n" +
			body +
			"}\n\n",
	};
};
