import { cac } from "cac";

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
	const cli = cac("ekzemplo2");
	cli.option("--dump-ast", "Dump AST as JSON");
	cli.option("--emit-llvm", "Emit LLVM IR (.ll)");
	cli.option("--compile", "Emit LLVM IR and compile with clang");
	cli.option("--out-dir <dir>", "Output directory", { default: "output" });
	cli.option("--out-name <name>", "Output base name");

	cli.parse(["node", "ekzemplo2", ...argv], { run: false });

	if (cli.args.length > 1) {
		throw new Error(`unexpected extra argument: ${String(cli.args[1])}`);
	}

	const parsed = cli.options as {
		dumpAst?: boolean;
		emitLlvm?: boolean;
		compile?: boolean;
		outDir?: string;
		outName?: string;
	};

	const compile = Boolean(parsed.compile);
	const emitLlvm = Boolean(parsed.emitLlvm) || compile;
	const filePath = cli.args[0] as string | undefined;

	return {
		filePath,
		options: {
			dumpAst: Boolean(parsed.dumpAst),
			emitLlvm,
			compile,
			outDir: parsed.outDir ?? "output",
			outName: parsed.outName,
		},
	};
};
