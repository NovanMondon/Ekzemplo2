import { Position, Range } from "vscode-languageserver/node";

import { TokenSpan, TokenType } from "./lspModel";

export const createRange = (line: number, start: number, length: number): Range => {
	return Range.create(line, start, line, start + length);
};

export const getWordAtPosition = (
	lines: string[],
	position: Position,
): { text: string; range: Range } | null => {
	const line = lines[position.line] ?? "";
	if (line.length === 0) {
		return null;
	}
	let cursor = position.character;
	if (cursor >= line.length) {
		cursor = line.length - 1;
	}
	if (cursor < 0) {
		return null;
	}

	const isWord = (ch: string): boolean => /[A-Za-z0-9_]/.test(ch);
	if (!isWord(line[cursor] ?? "")) {
		if (!isWord(line[cursor - 1] ?? "")) {
			return null;
		}
		cursor -= 1;
	}

	let start = cursor;
	let end = cursor;
	while (start > 0 && isWord(line[start - 1] ?? "")) {
		start -= 1;
	}
	while (end + 1 < line.length && isWord(line[end + 1] ?? "")) {
		end += 1;
	}

	const text = line.slice(start, end + 1);
	if (text.length === 0) {
		return null;
	}

	return {
		text,
		range: createRange(position.line, start, text.length),
	};
};

export const countBracesDelta = (lineText: string): number => {
	let delta = 0;
	for (const ch of lineText) {
		if (ch === "{") {
			delta += 1;
		} else if (ch === "}") {
			delta -= 1;
		}
	}
	return delta;
};

export const pushRegexMatches = (
	lineText: string,
	line: number,
	regex: RegExp,
	type: TokenType,
	push: (token: TokenSpan) => void,
): void => {
	for (const match of lineText.matchAll(regex)) {
		const text = match[0];
		if (!text) {
			continue;
		}
		const start = match.index ?? -1;
		if (start < 0) {
			continue;
		}
		push({
			line,
			start,
			length: text.length,
			type,
		});
	}
};
