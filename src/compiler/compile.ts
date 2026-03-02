import type { Program } from "../frontend/ast.js";
import { buildAst, parseProgram } from "../frontend/parser.js";
import type { ParseProgramResult } from "../frontend/parser.js";
import { emitLlvmIR } from "../backend/llvm/program.js";

export type CompileArtifacts = {
	parser: ParseProgramResult["parser"];
	tree: ParseProgramResult["tree"];
	ast: Program;
};

export const compileToAst = (sourceText: string): CompileArtifacts => {
	const { parser, tree } = parseProgram(sourceText);
	const ast = buildAst(tree);
	return { parser, tree, ast };
};

export const compileAstToLlvmIr = (ast: Program, sourceFilename: string): string => {
	return emitLlvmIR(ast, { sourceFilename });
};

export const compileToLlvmIr = (
	sourceText: string,
	sourceFilename: string,
): CompileArtifacts & { llvmIR: string } => {
	const artifacts = compileToAst(sourceText);
	const llvmIR = compileAstToLlvmIr(artifacts.ast, sourceFilename);
	return { ...artifacts, llvmIR };
};
