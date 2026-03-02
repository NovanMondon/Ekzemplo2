import type { SourceLocation } from "../frontend/sourceLocation.js";

export type CompileDiagnosticKind = "syntax" | "type" | "semantic";

export class CompileDiagnosticError extends Error {
	public readonly kind: CompileDiagnosticKind;
	public readonly location?: SourceLocation;
	public readonly nearText?: string;

	public constructor(
		kind: CompileDiagnosticKind,
		message: string,
		options?: { location?: SourceLocation; nearText?: string },
	) {
		super(message);
		this.name = "CompileDiagnosticError";
		this.kind = kind;
		this.location = options?.location;
		this.nearText = options?.nearText;
	}
}

export const isCompileDiagnosticError = (value: unknown): value is CompileDiagnosticError => {
	return value instanceof CompileDiagnosticError;
};

export const formatCompileDiagnostic = (error: CompileDiagnosticError): string => {
	const source = error.location?.sourceName ?? "<input>";
	const position = error.location
		? `${source}:${error.location.line}:${error.location.column}`
		: source;
	const near = error.nearText ? ` near '${error.nearText}'` : "";
	return `${position}: ${error.kind} error: ${error.message}${near}`;
};

type Locatable = { loc?: SourceLocation };

export const semanticError = (message: string, node?: Locatable): CompileDiagnosticError => {
	return new CompileDiagnosticError("semantic", message, { location: node?.loc });
};

export const typeError = (message: string, node?: Locatable): CompileDiagnosticError => {
	return new CompileDiagnosticError("type", message, { location: node?.loc });
};
