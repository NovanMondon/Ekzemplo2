import * as antlr from "antlr4ng";

export class ThrowingErrorListener extends antlr.BaseErrorListener {
	public override syntaxError(
		_recognizer: antlr.Recognizer<antlr.ATNSimulator>,
		offendingSymbol: antlr.Token | null,
		line: number,
		charPositionInLine: number,
		msg: string,
		_e: antlr.RecognitionException | null,
	): void {
		const near = offendingSymbol?.text ? ` near '${offendingSymbol.text}'` : "";
		throw new SyntaxError(`line ${line}:${charPositionInLine} ${msg}${near}`);
	}
}
