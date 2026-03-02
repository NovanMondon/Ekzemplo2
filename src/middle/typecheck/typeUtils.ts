import type { AstNode, TypeNode } from "../../frontend/ast.js";
import { semanticError } from "../../diagnostics/compileDiagnostic.js";
import { match } from "ts-pattern";

export const isSameType = (left: TypeNode, right: TypeNode): boolean => {
	if (left.kind !== right.kind) {
		return false;
	}
	if (left.kind !== "ArrayType" || right.kind !== "ArrayType") {
		return true;
	}
	return left.length === right.length && left.elementType.kind === right.elementType.kind;
};

export const typeToString = (type: TypeNode): string => {
	return match(type)
		.with({ kind: "IntType" }, () => "int")
		.with({ kind: "BoolType" }, () => "bool")
		.with({ kind: "StringType" }, () => "string")
		.with({ kind: "CharType" }, () => "char")
		.with({ kind: "ArrayType" }, (arrayType) => {
			const elementType = match(arrayType.elementType)
				.with({ kind: "IntType" }, () => "int")
				.with({ kind: "BoolType" }, () => "bool")
				.with({ kind: "CharType" }, () => "char")
				.with({ kind: "StringType" }, () => "string")
				.exhaustive();
			return `${elementType}[${arrayType.rawLength}]`;
		})
		.exhaustive();
};

export const ensureSemanticSupportedType = (type: TypeNode, node: AstNode, where: string): void => {
	if (type.kind === "ArrayType" && type.elementType.kind === "StringType") {
		throw semanticError(`string[] is not supported yet (${where})`, node);
	}
};
