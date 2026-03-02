import type { Program } from "../../frontend/ast.js";
import type { EmitContext } from "./env.js";
import { lowerMinimalFunction } from "./function.js";
import { escapeLlvmString } from "./escape.js";

export const emitLlvmIR = (program: Program, ctx: EmitContext): string => {
	if (program.functions.length === 0) {
		throw new Error("no function definitions");
	}

	const seen = new Set<string>();
	let moduleIr =
		`; ModuleID = 'Ekzemplo2'\n` +
		`source_filename = "${escapeLlvmString(ctx.sourceFilename)}"\n` +
		"\n";
	for (const fn of program.functions) {
		const { functionName, llvmIr } = lowerMinimalFunction(fn, ctx);
		if (seen.has(functionName)) {
			throw new Error(`duplicate function name: ${functionName}`);
		}
		seen.add(functionName);
		moduleIr += llvmIr;
	}

	return moduleIr;
};
