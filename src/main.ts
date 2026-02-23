import * as antlr from "antlr4ng";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import { buildAst, ThrowingErrorListener } from "./parser.js";
import { emitLlvmIR } from "./llvm/program.js";

export const main = async (): Promise<void> => {
	const { filePath, options } = parseArgs(process.argv.slice(2));
	const sourceText = filePath ? await readFile(filePath, "utf8") : await readAllStdin();

	const { parser, tree } = parseProgram(sourceText);
	if (options.dumpAst) {
		const ast = buildAst(tree);
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

		const ast = buildAst(tree);
		const llvmIR = emitLlvmIR(ast, { sourceFilename: path.basename(filePath) });
		await writeFile(llPath, llvmIR, "utf8");
		console.log(`emit: ${llPath}`);

		if (options.compile) {
			const binPath = path.join(options.outDir, baseName);
			await runCommand("clang", [llPath, "-fuse-ld=lld", "-o", binPath]);
			console.log(`compile: ${binPath}`);
		}
	}
};

const readAllStdin = async (): Promise<string> => {
	if (process.stdin.isTTY) {
		return "";
	}

	return await new Promise<string>((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
};

export const parseProgram = (sourceText: string) => {
	const errorListener = new ThrowingErrorListener();

	const input = antlr.CharStream.fromString(sourceText);
	const lexer = new Ekzemplo2Lexer(input);
	lexer.removeErrorListeners();
	lexer.addErrorListener(errorListener);

	const tokens = new antlr.CommonTokenStream(lexer);
	tokens.fill();
	const errorChars = tokens.getTokens().filter((t) => t.type === Ekzemplo2Lexer.ERROR_CHAR);
	if (errorChars.length > 0) {
		const first = errorChars[0]!;
		throw new SyntaxError(
			`unexpected character '${first.text ?? ""}' at line ${first.line}:${first.column}`,
		);
	}

	const parser = new Ekzemplo2Parser(tokens);
	parser.removeErrorListeners();
	parser.addErrorListener(errorListener);

	const tree = parser.program();
	return { parser, tree };
};

type CliOptions = {
	dumpAst: boolean;
	emitLlvm: boolean;
	compile: boolean;
	outDir: string;
	outName?: string;
};

const parseArgs = (argv: string[]): { filePath?: string; options: CliOptions } => {
	let dumpAst = false;
	let emitLlvm = false;
	let compile = false;
	let outDir = "output";
	let outName: string | undefined;
	let filePath: string | undefined;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === "--dump-ast") {
			dumpAst = true;
			continue;
		}
		if (arg === "--emit-llvm") {
			emitLlvm = true;
			continue;
		}
		if (arg === "--compile") {
			compile = true;
			emitLlvm = true;
			continue;
		}
		if (arg === "--out-dir") {
			const value = argv[i + 1];
			if (!value) throw new Error("--out-dir requires a value");
			outDir = value;
			i++;
			continue;
		}
		if (arg === "--out-name") {
			const value = argv[i + 1];
			if (!value) throw new Error("--out-name requires a value");
			outName = value;
			i++;
			continue;
		}
		if (arg.startsWith("--")) {
			throw new Error(`unknown option: ${arg}`);
		}
		if (filePath) {
			throw new Error(`unexpected extra argument: ${arg}`);
		}
		filePath = arg;
	}

	return { filePath, options: { dumpAst, emitLlvm, compile, outDir, outName } };
};

const runCommand = async (command: string, args: string[]): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			reject(new Error(`${command} exited with code ${code ?? "null"}`));
		});
	});
};
