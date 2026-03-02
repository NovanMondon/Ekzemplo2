import type { SourceLocation } from "./sourceLocation.js";

type Located = {
	loc?: SourceLocation;
};

export type Program = {
	kind: "Program";
	externs: ExternFunctionDecl[];
	functions: FunctionDecl[];
} & Located;

export type ExternFunctionDecl = {
	kind: "ExternFunctionDecl";
	name: Identifier;
	returnType: TypeNode;
	params: ParamDecl[];
	isVariadic: boolean;
} & Located;

export type FunctionDecl = {
	kind: "FunctionDecl";
	name: Identifier;
	returnType: TypeNode;
	params: ParamDecl[];
	body: Block;
} & Located;

export type ParamDecl = {
	kind: "ParamDecl";
	name: Identifier;
	type: TypeNode;
} & Located;

export type Block = {
	kind: "Block";
	statements: Statement[];
} & Located;

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
} & Located;

export type AssignStmt = {
	kind: "AssignStmt";
	target: AssignTarget;
	value: Expr;
} & Located;

export type AssignTarget = Identifier | IndexExpr;

export type ExprStmt = {
	kind: "ExprStmt";
	value: Expr;
} & Located;

export type IfStmt = {
	kind: "IfStmt";
	condition: Expr;
	thenBranch: Statement;
	elseBranch?: Statement;
} & Located;

export type ForStmt = {
	kind: "ForStmt";
	init?: ForInit;
	condition?: Expr;
	update?: ForUpdate;
	body: Statement;
} & Located;

export type ForInit = VarDeclStmt | AssignStmt | ExprStmt;

export type ForUpdate = AssignStmt | ExprStmt;

export type WhileStmt = {
	kind: "WhileStmt";
	condition: Expr;
	body: Statement;
} & Located;

export type BreakStmt = {
	kind: "BreakStmt";
} & Located;

export type ContinueStmt = {
	kind: "ContinueStmt";
} & Located;

export type ReturnStmt = {
	kind: "ReturnStmt";
	value: Expr;
} & Located;

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
} & Located;

export type CallExpr = {
	kind: "CallExpr";
	callee: Identifier;
	args: Expr[];
} & Located;

export type BinaryExpr = {
	kind: "BinaryExpr";
	op: "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";
	left: Expr;
	right: Expr;
} & Located;

export type IntLiteral = {
	kind: "IntLiteral";
	value: number;
	raw: string;
} & Located;

export type StringLiteral = {
	kind: "StringLiteral";
	value: string;
	bytes: number[];
	raw: string;
} & Located;

export type CharLiteral = {
	kind: "CharLiteral";
	value: number;
	raw: string;
} & Located;

export type BoolLiteral = {
	kind: "BoolLiteral";
	value: boolean;
	raw: string;
} & Located;

export type Identifier = {
	kind: "Identifier";
	text: string;
} & Located;

export type IntType = {
	kind: "IntType";
} & Located;

export type BoolType = {
	kind: "BoolType";
} & Located;

export type StringType = {
	kind: "StringType";
} & Located;

export type CharType = {
	kind: "CharType";
} & Located;

export type ArrayType = {
	kind: "ArrayType";
	elementType: IntType | BoolType | CharType | StringType;
	length: number;
	rawLength: string;
} & Located;

export type TypeNode = IntType | BoolType | StringType | CharType | ArrayType;

export type CastExpr = {
	kind: "CastExpr";
	targetType: TypeNode;
	value: Expr;
} & Located;

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
