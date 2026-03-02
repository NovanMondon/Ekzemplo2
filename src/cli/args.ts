export type CliOptions = {
	dumpAst: boolean;
	emitLlvm: boolean;
	compile: boolean;
	outDir: string;
	outName?: string;
};

export type CliArgs = {
	filePath?: string;
	options: CliOptions;
};

export const parseArgs = (argv: string[]): CliArgs => {
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
