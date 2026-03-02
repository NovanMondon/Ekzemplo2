import { CompileDiagnosticError } from "../../diagnostics/compileDiagnostic.js";
import type { BoolType, CharType, IntType, StringType, TypeNode } from "../ast.js";
import type { TypeNameContext } from "../generated/Ekzemplo2Parser.js";
import { tokenLocation, withLoc } from "./location.js";

export const buildTypeName = (ctx: TypeNameContext, sourceName: string): TypeNode => {
	const scalarType = buildScalarType(ctx, sourceName);
	const lengthToken = ctx.INT();
	if (!lengthToken) {
		return scalarType;
	}
	const rawLength = lengthToken.getText();
	const length = Number.parseInt(rawLength, 10);
	if (!Number.isInteger(length) || length <= 0) {
		throw new CompileDiagnosticError(
			"syntax",
			`array length must be a positive integer: ${rawLength}`,
			{
				location: tokenLocation(lengthToken.symbol, sourceName),
				nearText: rawLength,
			},
		);
	}
	return withLoc(
		{
			kind: "ArrayType",
			elementType: scalarType,
			length,
			rawLength,
		},
		ctx,
		sourceName,
	);
};

const buildScalarType = (
	ctx: TypeNameContext,
	sourceName: string,
): IntType | BoolType | StringType | CharType => {
	const scalarTypeCtx = ctx.scalarType();
	if (!scalarTypeCtx) {
		throw new Error("internal error: expected scalarType");
	}
	if (scalarTypeCtx.KW_INT()) {
		return withLoc({ kind: "IntType" }, scalarTypeCtx, sourceName);
	}
	if (scalarTypeCtx.KW_BOOL()) {
		return withLoc({ kind: "BoolType" }, scalarTypeCtx, sourceName);
	}
	if (scalarTypeCtx.KW_STRING()) {
		return withLoc({ kind: "StringType" }, scalarTypeCtx, sourceName);
	}
	if (scalarTypeCtx.KW_CHAR()) {
		return withLoc({ kind: "CharType" }, scalarTypeCtx, sourceName);
	}
	throw new Error("internal error: invalid scalarType");
};
