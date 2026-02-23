import type { Program } from "../ast.js";
import type { EmitContext } from "./env.js";
import { lowerMinimalFunction } from "./function.js";

export const emitLlvmIR = (program: Program, ctx: EmitContext): string => {
	if (program.functions.length === 0) {
		throw new Error("no function definitions");
	}

	const seen = new Set<string>();
	const functionBlocks: string[] = [];
	for (const fn of program.functions) {
		const { functionName, bodyLines } = lowerMinimalFunction(fn, ctx);
		if (seen.has(functionName)) {
			throw new Error(`duplicate function name: ${functionName}`);
		}
		seen.add(functionName);

		// Minimal LLVM IR for: `int <name>() { return <int>; }`
		// We keep it intentionally small; clang can compile .ll directly.
		functionBlocks.push(
			[
				`define i32 @${escapeLlvmIdentifier(functionName)}() {`,
				"entry:",
				...bodyLines,
				"}",
				"",
			].join("\n"),
		);
	}

	return [
		`; ModuleID = 'Ekzemplo2'`,
		`source_filename = "${escapeLlvmString(ctx.sourceFilename)}"`,
		"",
		...functionBlocks,
	].join("\n");
};

const escapeLlvmIdentifier = (name: string): string => {
	// LLVM identifiers can be either: @name or @"name with spaces"
	// We keep it simple and quote if it contains characters outside [A-Za-z0-9_.$].
	return /^[A-Za-z0-9_.$]+$/.test(name) ? name : `"${escapeLlvmString(name)}"`;
};

const escapeLlvmString = (value: string): string => {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};
