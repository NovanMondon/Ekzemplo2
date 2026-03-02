import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Ekzemplo2Parser } from "../frontend/generated/Ekzemplo2Parser.js";
import { parseArgs } from "./args.js";
import { readSourceText } from "./io.js";
import { compileAstToLlvmIr, compileToAst } from "../compiler/compile.js";
import { compileLlvmIrWithClang } from "../toolchain/clang.js";

export const runCli = async (argv: string[]): Promise<void> => {
	const { filePath, options } = parseArgs(argv);
	const sourceText = await readSourceText(filePath);
	const { parser, tree, ast } = compileToAst(sourceText);

	if (options.dumpAst) {
		console.log(JSON.stringify(ast, null, 2));
		return;
	}

	console.log("parse: ok");
	console.log(tree.toStringTree(Ekzemplo2Parser.ruleNames, parser));

	if (options.emitLlvm || options.compile) {
		if (!filePath) {
			throw new Error("--emit-llvm/--compile requires an input file path");
		}

		await mkdir(options.outDir, { recursive: true });
		const baseName = options.outName ?? path.parse(filePath).name;
		const llPath = path.join(options.outDir, `${baseName}.ll`);
		const llvmIR = compileAstToLlvmIr(ast, path.basename(filePath));
		await writeFile(llPath, llvmIR, "utf8");
		console.log(`emit: ${llPath}`);

		if (options.compile) {
			const binPath = path.join(options.outDir, baseName);
			await compileLlvmIrWithClang(llPath, binPath);
			console.log(`compile: ${binPath}`);
		}
	}
};
