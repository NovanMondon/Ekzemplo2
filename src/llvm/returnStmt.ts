import { ReturnStmt } from "../ast.js";

export const lowerReturnValue = (stmt: ReturnStmt): number => {
	const expr = stmt.value;
	if (expr.kind !== "IntLiteral") {
		throw new Error("only int literals are supported in return");
	}
	return expr.value;
};
