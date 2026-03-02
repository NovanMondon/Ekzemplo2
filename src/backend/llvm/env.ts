import type { TypeNode } from "../../frontend/ast.js";

export type EmitContext = {
	sourceFilename: string;
};

export type FunctionSignature = {
	returnType: TypeNode;
	params: TypeNode[];
};

export type ModuleEmitContext = EmitContext & {
	functions: Map<string, FunctionSignature>;
};

export type VariableBinding = {
	type: TypeNode;
	pointer: string;
};

export type FunctionEmitContext = ModuleEmitContext & {
	nextTemp: () => string;
	nextLabel: (prefix: string) => string;
	scopes: Map<string, VariableBinding>[];
};
