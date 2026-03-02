import * as antlr from "antlr4ng";

import type { BoolLiteral, CharLiteral, IntLiteral, StringLiteral } from "../ast.js";
import { CompileDiagnosticError } from "../../diagnostics/compileDiagnostic.js";
import type { SourceLocation } from "../sourceLocation.js";
import { tokenLocation, withLoc } from "./location.js";

export const parseIntLiteral = (token: antlr.TerminalNode, sourceName: string): IntLiteral => {
	const text = token.getText();
	const value = Number.parseInt(text, 10);
	if (!Number.isFinite(value)) {
		throw new CompileDiagnosticError("syntax", `invalid int literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	return withLoc({ kind: "IntLiteral", value, raw: text }, token, sourceName);
};

export const parseBoolLiteral = (token: antlr.TerminalNode, sourceName: string): BoolLiteral => {
	const text = token.getText();
	if (text !== "true" && text !== "false") {
		throw new CompileDiagnosticError("syntax", `invalid bool literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	return withLoc({ kind: "BoolLiteral", value: text === "true", raw: text }, token, sourceName);
};

export const parseStringLiteral = (
	token: antlr.TerminalNode,
	sourceName: string,
): StringLiteral => {
	const text = token.getText();
	if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"')) {
		throw new CompileDiagnosticError("syntax", `invalid string literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	const content = text.slice(1, -1);
	const bytes = decodeEscapedAscii(content, text, tokenLocation(token.symbol, sourceName));
	const value = String.fromCharCode(...bytes);
	return withLoc(
		{
			kind: "StringLiteral",
			value,
			bytes,
			raw: text,
		},
		token,
		sourceName,
	);
};

export const parseCharLiteral = (token: antlr.TerminalNode, sourceName: string): CharLiteral => {
	const text = token.getText();
	if (text.length < 3 || !text.startsWith("'") || !text.endsWith("'")) {
		throw new CompileDiagnosticError("syntax", `invalid char literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	const content = text.slice(1, -1);
	const bytes = decodeEscapedAscii(content, text, tokenLocation(token.symbol, sourceName));
	if (bytes.length !== 1) {
		throw new CompileDiagnosticError(
			"syntax",
			`char literal must contain exactly one byte: ${text}`,
			{
				location: tokenLocation(token.symbol, sourceName),
				nearText: text,
			},
		);
	}
	return withLoc(
		{
			kind: "CharLiteral",
			value: bytes[0]!,
			raw: text,
		},
		token,
		sourceName,
	);
};

const decodeEscapedAscii = (
	content: string,
	rawLiteral: string,
	location: SourceLocation,
): number[] => {
	const bytes: number[] = [];
	for (let i = 0; i < content.length; i++) {
		const ch = content[i]!;
		if (ch !== "\\") {
			const code = ch.charCodeAt(0);
			if (code > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`non-ascii character is not supported: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(code);
			continue;
		}

		i++;
		if (i >= content.length) {
			throw new CompileDiagnosticError("syntax", `incomplete escape sequence: ${rawLiteral}`, {
				location,
				nearText: rawLiteral,
			});
		}
		const esc = content[i]!;
		const simple = decodeSimpleEscape(esc);
		if (simple !== null) {
			bytes.push(simple);
			continue;
		}

		if (esc === "x") {
			const next = content.slice(i + 1, i + 3);
			if (!/^[0-9A-Fa-f]{2}$/.test(next)) {
				throw new CompileDiagnosticError("syntax", `invalid hex escape sequence: ${rawLiteral}`, {
					location,
					nearText: rawLiteral,
				});
			}
			const value = Number.parseInt(next, 16);
			if (value > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`hex escape is out of ascii range: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(value);
			i += 2;
			continue;
		}

		if (/[0-7]/.test(esc)) {
			let oct = esc;
			let j = i + 1;
			while (j < content.length && oct.length < 3 && /[0-7]/.test(content[j]!)) {
				oct += content[j]!;
				j++;
			}
			const value = Number.parseInt(oct, 8);
			if (value > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`octal escape is out of ascii range: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(value);
			i = j - 1;
			continue;
		}

		throw new CompileDiagnosticError("syntax", `unsupported escape sequence: \\${esc}`, {
			location,
			nearText: rawLiteral,
		});
	}
	return bytes;
};

const decodeSimpleEscape = (esc: string): number | null => {
	switch (esc) {
		case "a":
			return 0x07;
		case "b":
			return 0x08;
		case "f":
			return 0x0c;
		case "n":
			return 0x0a;
		case "r":
			return 0x0d;
		case "t":
			return 0x09;
		case "v":
			return 0x0b;
		case "\\":
			return 0x5c;
		case "'":
			return 0x27;
		case '"':
			return 0x22;
		case "?":
			return 0x3f;
		default:
			return null;
	}
};
