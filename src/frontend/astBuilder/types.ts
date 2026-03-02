import type {
	Block,
	Expr,
	ExternFunctionDecl,
	FunctionDecl,
	ParamDecl,
	Program,
	Statement,
	TypeNode,
} from "../ast.js";

export type AstResult =
	| Program
	| ExternFunctionDecl
	| FunctionDecl
	| ParamDecl
	| Block
	| Statement
	| Expr
	| TypeNode;

export const isExpr = (node: AstResult): node is Expr => {
	return (
		node.kind === "IntLiteral" ||
		node.kind === "StringLiteral" ||
		node.kind === "CharLiteral" ||
		node.kind === "BoolLiteral" ||
		node.kind === "Identifier" ||
		node.kind === "BinaryExpr" ||
		node.kind === "CastExpr" ||
		node.kind === "CallExpr" ||
		node.kind === "IndexExpr"
	);
};

export const isTypeNode = (node: AstResult): node is TypeNode => {
	return (
		node.kind === "IntType" ||
		node.kind === "BoolType" ||
		node.kind === "StringType" ||
		node.kind === "CharType" ||
		node.kind === "ArrayType"
	);
};

export const isStatement = (node: AstResult): node is Statement => {
	return (
		node.kind === "VarDeclStmt" ||
		node.kind === "AssignStmt" ||
		node.kind === "ExprStmt" ||
		node.kind === "IfStmt" ||
		node.kind === "ForStmt" ||
		node.kind === "WhileStmt" ||
		node.kind === "BreakStmt" ||
		node.kind === "ContinueStmt" ||
		node.kind === "ReturnStmt" ||
		node.kind === "Block"
	);
};

export const expectExprResult = (result: AstResult | null): Expr => {
	if (!result || !isExpr(result)) {
		throw new Error("internal error: expected Expr");
	}
	return result;
};
