import type {
	BoolType,
	CharType,
	Expr,
	IntType,
	StringType,
	TypeNode,
} from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";

export type LoweredExpr = {
	code: string;
	value: string;
	type: TypeNode;
};

export type LowerExprFn = (expr: Expr, ctx: FunctionEmitContext) => LoweredExpr;

export const intType: IntType = { kind: "IntType" };
export const boolType: BoolType = { kind: "BoolType" };
export const charType: CharType = { kind: "CharType" };
export const stringType: StringType = { kind: "StringType" };

const llvmScalarTypeFor = (
	type: IntType | BoolType | CharType | StringType,
): "i32" | "i1" | "i8" | "i8*" => {
	if (type.kind === "IntType") {
		return "i32";
	}
	if (type.kind === "BoolType") {
		return "i1";
	}
	if (type.kind === "CharType") {
		return "i8";
	}
	return "i8*";
};

export const llvmTypeFor = (type: TypeNode): string => {
	if (type.kind === "ArrayType") {
		return `[${type.length} x ${llvmScalarTypeFor(type.elementType)}]`;
	}
	return llvmScalarTypeFor(type);
};

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
