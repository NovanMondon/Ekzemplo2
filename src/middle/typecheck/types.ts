import type { TypeNode } from "../../frontend/ast.js";

export type FunctionSignature = {
	returnType: TypeNode;
	params: TypeNode[];
	isVariadic: boolean;
};

export type ExitKind = "none" | "return" | "break" | "continue" | "mixed";

export type TypecheckContext = {
	functions: Map<string, FunctionSignature>;
	scopes: Map<string, TypeNode>[];
	loopDepth: number;
	sourceFilename: string;
};
