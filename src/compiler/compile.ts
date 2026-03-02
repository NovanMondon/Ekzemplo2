import type { Program } from "../frontend/ast.js";
import { buildAst, parseProgram } from "../frontend/parser.js";
import type { ParseProgramResult } from "../frontend/parser.js";
import { emitLlvmIR } from "../backend/llvm/program.js";
import { typecheckProgram } from "../middle/typecheck.js";
import { isCompileDiagnosticError } from "../diagnostics/compileDiagnostic.js";
import { buildLspIndex, type LspIndexOutput } from "./lspIndex.js";

export type CompileArtifacts = {
	parser: ParseProgramResult["parser"];
	tree: ParseProgramResult["tree"];
	ast: Program;
};

export const compileToAst = (sourceText: string, sourceName?: string): CompileArtifacts => {
	const { parser, tree } = parseProgram(sourceText, sourceName);
	const ast = buildAst(tree, sourceName);
	return { parser, tree, ast };
};

export const compileAstToLlvmIr = (ast: Program, sourceFilename: string): string => {
	typecheckProgram(ast, sourceFilename);
	return emitLlvmIR(ast, { sourceFilename });
};

export const compileToLlvmIr = (
	sourceText: string,
	sourceFilename: string,
): CompileArtifacts & { llvmIR: string } => {
	const artifacts = compileToAst(sourceText, sourceFilename);
	const llvmIR = compileAstToLlvmIr(artifacts.ast, sourceFilename);
	return { ...artifacts, llvmIR };
};

export const compileToLspIndex = (sourceText: string, sourceName?: string): LspIndexOutput => {
	const { ast } = compileToAst(sourceText, sourceName);
	const index = buildLspIndex(ast);

	try {
		typecheckProgram(ast, sourceName ?? "<input>");
	} catch (error) {
		if (!isCompileDiagnosticError(error)) {
			throw error;
		}

		const line = Math.max(0, (error.location?.line ?? 1) - 1);
		const column = Math.max(0, error.location?.column ?? 0);
		const nearTextLength = error.nearText?.length ?? 0;
		index.diagnostics.push({
			severity: "error",
			message: error.message,
			line,
			column,
			length: Math.max(1, nearTextLength),
		});
	}

	return index;
};
