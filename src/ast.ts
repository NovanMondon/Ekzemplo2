export type Program = {
	kind: "Program";
	functions: FunctionDecl[];
};

export type FunctionDecl = {
	kind: "FunctionDecl";
	name: Identifier;
	returnType: IntType;
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

export type Expr = IntLiteral | Identifier;

export type IntLiteral = {
	kind: "IntLiteral";
	value: number;
	raw: string;
};

export type Identifier = {
	kind: "Identifier";
	text: string;
};

export type IntType = {
	kind: "IntType";
};

export type AstNode =
	| Program
	| FunctionDecl
	| Block
	| ReturnStmt
	| IntLiteral
	| Identifier
	| IntType;
