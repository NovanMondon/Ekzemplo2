import type { Program } from "../../frontend/ast.js";
import type { EmitContext, FunctionSignature, ModuleEmitContext } from "./env.js";
import { lowerMinimalFunction } from "./function.js";
import { escapeLlvmString } from "./escape.js";

export const emitLlvmIR = (program: Program, ctx: EmitContext): string => {
	if (program.functions.length === 0) {
		throw new Error("no function definitions");
	}

	const functions = new Map<string, FunctionSignature>();
	for (const fn of program.functions) {
		if (functions.has(fn.name.text)) {
			throw new Error(`duplicate function name: ${fn.name.text}`);
		}
		functions.set(fn.name.text, {
			returnType: fn.returnType,
			params: fn.params.map((p) => p.type),
		});
	}

	const moduleCtx: ModuleEmitContext = {
		...ctx,
		functions,
	};

	let moduleIr =
		`; ModuleID = 'Ekzemplo2'\n` +
		`source_filename = "${escapeLlvmString(ctx.sourceFilename)}"\n` +
		"\n";
	for (const fn of program.functions) {
		const { llvmIr } = lowerMinimalFunction(fn, moduleCtx);
		moduleIr += llvmIr;
	}

	return moduleIr;
};
