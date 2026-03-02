import * as antlr from "antlr4ng";

import type { Program } from "./ast.js";
import { AstBuilder } from "./astBuilder.js";
import { CompileDiagnosticError } from "../diagnostics/compileDiagnostic.js";
import type { SourceLocation } from "./sourceLocation.js";
import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type { ProgramContext } from "./generated/Ekzemplo2Parser.js";

export class ThrowingErrorListener extends antlr.BaseErrorListener {
	public constructor(private readonly sourceName: string) {
		super();
	}

	public override syntaxError(
		_recognizer: antlr.Recognizer<antlr.ATNSimulator>,
		offendingSymbol: antlr.Token | null,
		line: number,
		charPositionInLine: number,
		msg: string,
		_e: antlr.RecognitionException | null,
	): void {
		throw new CompileDiagnosticError("syntax", msg, {
			location: {
				line,
				column: charPositionInLine,
				sourceName: this.sourceName,
			},
			nearText: offendingSymbol?.text ?? undefined,
		});
	}
}

export type ParseProgramResult = {
	parser: Ekzemplo2Parser;
	tree: ProgramContext;
};

export const parseProgram = (sourceText: string, sourceName = "<input>"): ParseProgramResult => {
	const errorListener = new ThrowingErrorListener(sourceName);

	const input = antlr.CharStream.fromString(sourceText);
	const lexer = new Ekzemplo2Lexer(input);
	lexer.removeErrorListeners();
	lexer.addErrorListener(errorListener);

	const tokens = new antlr.CommonTokenStream(lexer);
	tokens.fill();
	const errorChars = tokens.getTokens().filter((t) => t.type === Ekzemplo2Lexer.ERROR_CHAR);
	if (errorChars.length > 0) {
		const first = errorChars[0]!;
		throw new CompileDiagnosticError("syntax", `unexpected character '${first.text ?? ""}'`, {
			location: tokenLocation(first, sourceName),
			nearText: first.text ?? undefined,
		});
	}

	const parser = new Ekzemplo2Parser(tokens);
	parser.removeErrorListeners();
	parser.addErrorListener(errorListener);

	const tree = parser.program();
	return { parser, tree };
};

export const buildAst = (tree: ProgramContext, sourceName = "<input>"): Program => {
	const visitor = new AstBuilder(sourceName);
	const result = tree.accept(visitor);
	if (!result || result.kind !== "Program") {
		throw new Error("internal error: failed to build AST Program");
	}
	return result;
};

const tokenLocation = (token: antlr.Token, sourceName?: string): SourceLocation => {
	return {
		line: token.line,
		column: token.column,
		sourceName,
	};
};

export const debugRuleNames = () => Ekzemplo2Parser.ruleNames;
export const debugSymbolicNames = () => Ekzemplo2Parser.symbolicNames;
