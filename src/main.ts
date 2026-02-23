
import * as antlr from "antlr4ng";
import { readFile } from "node:fs/promises";

import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import { ThrowingErrorListener } from "./parser.js";

export const main = async (): Promise<void> => {
	const args = process.argv.slice(2);
	const filePath = args[0];
	const sourceText = filePath ? await readFile(filePath, "utf8") : await readAllStdin();

	const { parser, tree } = parseProgram(sourceText);
	console.log("parse: ok");
	console.log(tree.toStringTree(Ekzemplo2Parser.ruleNames, parser));
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
	const errorChars = tokens
		.getTokens()
		.filter((t) => t.type === Ekzemplo2Lexer.ERROR_CHAR);
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
