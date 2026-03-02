import type { AstNode, TypeNode } from "../../frontend/ast.js";
import { semanticError } from "../../diagnostics/compileDiagnostic.js";

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
	if (type.kind === "IntType") {
		return "int";
	}
	if (type.kind === "BoolType") {
		return "bool";
	}
	if (type.kind === "StringType") {
		return "string";
	}
	if (type.kind === "CharType") {
		return "char";
	}
	const elementType =
		type.elementType.kind === "IntType"
			? "int"
			: type.elementType.kind === "BoolType"
				? "bool"
				: type.elementType.kind === "CharType"
					? "char"
					: "string";
	return `${elementType}[${type.rawLength}]`;
};

export const ensureSemanticSupportedType = (type: TypeNode, node: AstNode, where: string): void => {
	if (type.kind === "ArrayType" && type.elementType.kind === "StringType") {
		throw semanticError(`string[] is not supported yet (${where})`, node);
	}
};
