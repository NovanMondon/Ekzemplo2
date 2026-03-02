export type Program = {
	kind: "Program";
	functions: FunctionDecl[];
};

export type FunctionDecl = {
	kind: "FunctionDecl";
	name: Identifier;
	returnType: TypeNode;
	params: [];
	body: Block;
};

export type Block = {
	kind: "Block";
	statements: Statement[];
};

export type Statement = ReturnStmt;

export type ReturnStmt = {
	kind: "ReturnStmt";
	value: Expr;
};

export type Expr = IntLiteral | BoolLiteral | Identifier | BinaryExpr | CastExpr;

export type BinaryExpr = {
	kind: "BinaryExpr";
	op: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";
	left: Expr;
	right: Expr;
};

export type IntLiteral = {
	kind: "IntLiteral";
	value: number;
	raw: string;
};

export type BoolLiteral = {
	kind: "BoolLiteral";
	value: boolean;
	raw: string;
};

export type Identifier = {
	kind: "Identifier";
	text: string;
};

export type IntType = {
	kind: "IntType";
};

export type BoolType = {
	kind: "BoolType";
};

export type TypeNode = IntType | BoolType;

export type CastExpr = {
	kind: "CastExpr";
	targetType: TypeNode;
	value: Expr;
};

export type AstNode =
	| Program
	| FunctionDecl
	| Block
	| ReturnStmt
	| BinaryExpr
	| IntLiteral
	| BoolLiteral
	| Identifier
	| IntType
	| BoolType
	| CastExpr;
