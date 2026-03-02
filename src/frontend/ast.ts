export type Program = {
	kind: "Program";
	externs: ExternFunctionDecl[];
	functions: FunctionDecl[];
};

export type ExternFunctionDecl = {
	kind: "ExternFunctionDecl";
	name: Identifier;
	returnType: TypeNode;
	params: ParamDecl[];
	isVariadic: boolean;
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
	target: AssignTarget;
	value: Expr;
};

export type AssignTarget = Identifier | IndexExpr;

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

export type Expr =
	| IntLiteral
	| StringLiteral
	| CharLiteral
	| BoolLiteral
	| Identifier
	| BinaryExpr
	| CastExpr
	| CallExpr
	| IndexExpr;

export type IndexExpr = {
	kind: "IndexExpr";
	array: Identifier;
	index: Expr;
};

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

export type StringLiteral = {
	kind: "StringLiteral";
	value: string;
	bytes: number[];
	raw: string;
};

export type CharLiteral = {
	kind: "CharLiteral";
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

export type StringType = {
	kind: "StringType";
};

export type CharType = {
	kind: "CharType";
};

export type ArrayType = {
	kind: "ArrayType";
	elementType: IntType | BoolType | CharType;
	length: number;
	rawLength: string;
};

export type TypeNode = IntType | BoolType | StringType | CharType | ArrayType;

export type CastExpr = {
	kind: "CastExpr";
	targetType: TypeNode;
	value: Expr;
};

export type AstNode =
	| Program
	| ExternFunctionDecl
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
	| IndexExpr
	| BinaryExpr
	| IntLiteral
	| StringLiteral
	| CharLiteral
	| BoolLiteral
	| Identifier
	| IntType
	| BoolType
	| StringType
	| CharType
	| ArrayType
	| CastExpr;
