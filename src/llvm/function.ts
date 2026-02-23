import type { FunctionDecl } from "../ast.js";
import { lowerReturnValue } from "./returnStmt.js";

export const lowerMinimalFunction = (
	fn: FunctionDecl,
): { functionName: string; returnValue: number } => {
	if (fn.returnType.kind !== "IntType") {
		throw new Error("only int return type is supported");
	}
	const returnStmt = fn.body.statements[0];
	if (!returnStmt || returnStmt.kind !== "ReturnStmt") {
		throw new Error("expected return statement");
	}
	return {
		functionName: fn.name.text,
		returnValue: lowerReturnValue(returnStmt),
	};
};
