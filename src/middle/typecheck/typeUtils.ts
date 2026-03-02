import type { TypeNode } from "../../frontend/ast.js";

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
				: "char";
	return `${elementType}[${type.rawLength}]`;
};
