export type Program = {
	kind: "Program";
	functions: FunctionDecl[];
};

export type FunctionDecl = {
	kind: "FunctionDecl";
	name: Identifier;
	returnType: TypeNode;
	params: ParamDecl[];
	body: Block;
};

export type ParamDecl = {
	kind: "ParamDecl";
	name: Identifier;
	type: TypeNode;
};

export type Block = {
	kind: "Block";
	statements: Statement[];
};

export type Statement =
	| VarDeclStmt
	| AssignStmt
	| ExprStmt
	| IfStmt
	| ForStmt
	| WhileStmt
	| BreakStmt
	| ContinueStmt
	| ReturnStmt
	| Block;

export type VarDeclStmt = {
	kind: "VarDeclStmt";
	name: Identifier;
	type: TypeNode;
	initializer?: Expr;
};

export type AssignStmt = {
	kind: "AssignStmt";
	target: Identifier;
	value: Expr;
};

export type ExprStmt = {
	kind: "ExprStmt";
	value: Expr;
};

export type IfStmt = {
	kind: "IfStmt";
	condition: Expr;
	thenBranch: Statement;
	elseBranch?: Statement;
};

export type ForStmt = {
	kind: "ForStmt";
	init?: ForInit;
	condition?: Expr;
	update?: ForUpdate;
	body: Statement;
};

export type ForInit = VarDeclStmt | AssignStmt | ExprStmt;

export type ForUpdate = AssignStmt | ExprStmt;

export type WhileStmt = {
	kind: "WhileStmt";
	condition: Expr;
	body: Statement;
};

export type BreakStmt = {
	kind: "BreakStmt";
};

export type ContinueStmt = {
	kind: "ContinueStmt";
};

export type ReturnStmt = {
	kind: "ReturnStmt";
	value: Expr;
};

export type Expr = IntLiteral | BoolLiteral | Identifier | BinaryExpr | CastExpr | CallExpr;

export type CallExpr = {
	kind: "CallExpr";
	callee: Identifier;
	args: Expr[];
};

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
	| ParamDecl
	| Block
	| VarDeclStmt
	| AssignStmt
	| ExprStmt
	| IfStmt
	| ForStmt
	| WhileStmt
	| BreakStmt
	| ContinueStmt
	| ReturnStmt
	| CallExpr
	| BinaryExpr
	| IntLiteral
	| BoolLiteral
	| Identifier
	| IntType
	| BoolType
	| CastExpr;
