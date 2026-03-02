import type { TypeNode } from "../../frontend/ast.js";
import type { TypecheckContext } from "./types.js";

export const currentScope = (ctx: TypecheckContext): Map<string, TypeNode> => {
	return ctx.scopes[ctx.scopes.length - 1]!;
};

export const resolveVariable = (ctx: TypecheckContext, name: string): TypeNode | undefined => {
	for (let i = ctx.scopes.length - 1; i >= 0; i--) {
		const variableType = ctx.scopes[i]!.get(name);
		if (variableType) {
			return variableType;
		}
	}
	return undefined;
};
