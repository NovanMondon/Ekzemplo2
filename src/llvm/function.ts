import type { FunctionDecl } from "../ast.js";
import type { EmitContext, FunctionEmitContext } from "./env.js";
import { escapeLlvmIdentifier } from "./escape.js";
import { lowerReturnStatement } from "./returnStmt.js";

export const lowerMinimalFunction = (
	fn: FunctionDecl,
	ctx: EmitContext,
): { functionName: string; llvmIr: string } => {
	if (fn.returnType.kind !== "IntType") {
		throw new Error("only int return type is supported");
	}
	const returnStmt = fn.body.statements[0];
	if (!returnStmt || returnStmt.kind !== "ReturnStmt") {
		throw new Error("expected return statement");
	}
	let tempCounter = 0;
	const nextTemp = () => `%t${tempCounter++}`;
	const fnCtx: FunctionEmitContext = { ...ctx, nextTemp };
	const functionName = fn.name.text;
	const body = lowerReturnStatement(returnStmt, fnCtx);
	return {
		functionName,
		llvmIr: `define i32 @${escapeLlvmIdentifier(functionName)}() {\n` + "entry:\n" + body + "}\n\n",
	};
};
