import type { FunctionEmitContext, VariableBinding } from "./env.js";

export const resolveVariable = (
	ctx: FunctionEmitContext,
	name: string,
): VariableBinding | undefined => {
	for (let i = ctx.scopes.length - 1; i >= 0; i--) {
		const binding = ctx.scopes[i]!.get(name);
		if (binding) {
			return binding;
		}
	}
	return undefined;
};

export const currentScope = (ctx: FunctionEmitContext): Map<string, VariableBinding> => {
	return ctx.scopes[ctx.scopes.length - 1]!;
};
