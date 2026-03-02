import type { TypeNode } from "../../frontend/ast.js";

export type EmitContext = {
	sourceFilename: string;
};

export type FunctionSignature = {
	returnType: TypeNode;
	params: TypeNode[];
	isVariadic: boolean;
};

export type ModuleEmitContext = EmitContext & {
	functions: Map<string, FunctionSignature>;
	stringLiteralPool: Map<string, { globalName: string; llvmType: string }>;
	globalDefinitions: string[];
	nextStringLiteralGlobal: () => string;
};

export type VariableBinding = {
	type: TypeNode;
	pointer: string;
};

export type FunctionEmitContext = ModuleEmitContext & {
	nextTemp: () => string;
	nextLabel: (prefix: string) => string;
	scopes: Map<string, VariableBinding>[];
	loopTargets: { breakLabel: string; continueLabel: string }[];
};
