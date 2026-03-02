import * as antlr from "antlr4ng";

import type { SourceLocation } from "../sourceLocation.js";

export const tokenLocation = (token: antlr.Token, sourceName?: string): SourceLocation => {
	return {
		line: token.line,
		column: token.column,
		sourceName,
	};
};

export const contextLocation = (
	ctx: antlr.ParserRuleContext,
	sourceName?: string,
): SourceLocation => {
	const start = ctx.start;
	return {
		line: start?.line ?? 1,
		column: start?.column ?? 0,
		sourceName,
	};
};

export const withLoc = <T>(
	node: T,
	source: antlr.ParserRuleContext | antlr.Token | antlr.TerminalNode,
	sourceName?: string,
): T => {
	const base = node as object;
	if (source instanceof antlr.ParserRuleContext) {
		return { ...base, loc: contextLocation(source, sourceName) } as T;
	}
	if ("symbol" in source) {
		return { ...base, loc: tokenLocation(source.symbol, sourceName) } as T;
	}
	return { ...base, loc: tokenLocation(source, sourceName) } as T;
};
