import type { BoolType, Expr, IntType, TypeNode } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";

export type LoweredExpr = {
	code: string;
	value: string;
	type: TypeNode;
};

export type LowerExprFn = (expr: Expr, ctx: FunctionEmitContext) => LoweredExpr;

export const intType: IntType = { kind: "IntType" };
export const boolType: BoolType = { kind: "BoolType" };

const llvmScalarTypeFor = (type: IntType | BoolType): "i32" | "i1" => {
	return type.kind === "IntType" ? "i32" : "i1";
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
	return `${type.elementType.kind === "IntType" ? "int" : "bool"}[${type.rawLength}]`;
};
