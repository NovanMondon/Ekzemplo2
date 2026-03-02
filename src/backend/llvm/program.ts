import type { Program } from "../../frontend/ast.js";
import { semanticError } from "../../diagnostics/compileDiagnostic.js";
import type { EmitContext, FunctionSignature, ModuleEmitContext } from "./env.js";
import { lowerMinimalFunction } from "./function.js";
import { escapeLlvmIdentifier, escapeLlvmString } from "./escape.js";
import { llvmTypeFor } from "./expr.js";

export const emitLlvmIR = (program: Program, ctx: EmitContext): string => {
	if (program.functions.length === 0) {
		throw semanticError("no function definitions", program);
	}

	const functions = new Map<string, FunctionSignature>();
	const declareLines: string[] = [];
	for (const externFn of program.externs) {
		if (functions.has(externFn.name.text)) {
			throw semanticError(`duplicate function name: ${externFn.name.text}`, externFn);
		}
		functions.set(externFn.name.text, {
			returnType: externFn.returnType,
			params: externFn.params.map((p) => p.type),
			isVariadic: externFn.isVariadic,
		});
		const returnType = llvmTypeFor(externFn.returnType);
		const fixedParams = externFn.params.map((p) => llvmTypeFor(p.type));
		const params = externFn.isVariadic
			? fixedParams.length > 0
				? `${fixedParams.join(", ")}, ...`
				: "..."
			: fixedParams.join(", ");
		declareLines.push(
			`declare ${returnType} @${escapeLlvmIdentifier(externFn.name.text)}(${params})`,
		);
	}
	for (const fn of program.functions) {
		if (functions.has(fn.name.text)) {
			throw semanticError(`duplicate function name: ${fn.name.text}`, fn);
		}
		functions.set(fn.name.text, {
			returnType: fn.returnType,
			params: fn.params.map((p) => p.type),
			isVariadic: false,
		});
	}

	const moduleCtx: ModuleEmitContext = {
		...ctx,
		functions,
		stringLiteralPool: new Map(),
		globalDefinitions: [],
		nextStringLiteralGlobal: (() => {
			let index = 0;
			return () => `.str.${index++}`;
		})(),
	};

	const header =
		`; ModuleID = 'Ekzemplo2'\n` +
		`source_filename = "${escapeLlvmString(ctx.sourceFilename)}"\n` +
		"\n";
	let functionsIr = "";
	for (const fn of program.functions) {
		const { llvmIr } = lowerMinimalFunction(fn, moduleCtx);
		functionsIr += llvmIr;
	}

	const globalsIr =
		moduleCtx.globalDefinitions.length > 0 ? `${moduleCtx.globalDefinitions.join("\n")}\n\n` : "";
	const declaresIr = declareLines.length > 0 ? `${declareLines.join("\n")}\n\n` : "";
	const moduleIr = `${header}${globalsIr}${declaresIr}${functionsIr}`;

	return moduleIr;
};
