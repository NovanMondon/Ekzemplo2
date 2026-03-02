import type { Expr, TypeNode } from "../../frontend/ast.js";
import { semanticError, typeError } from "../../diagnostics/compileDiagnostic.js";
import { resolveVariable } from "./scope.js";
import type { TypecheckContext } from "./types.js";
import { isSameType, typeToString } from "./typeUtils.js";

export const typecheckExpr = (expr: Expr, ctx: TypecheckContext): TypeNode => {
	switch (expr.kind) {
		case "IntLiteral":
			return { kind: "IntType" };
		case "BoolLiteral":
			return { kind: "BoolType" };
		case "StringLiteral":
			return { kind: "StringType" };
		case "CharLiteral":
			return { kind: "CharType" };
		case "Identifier": {
			const variableType = resolveVariable(ctx, expr.text);
			if (!variableType) {
				throw semanticError(`undefined variable: ${expr.text} (in ${ctx.sourceFilename})`, expr);
			}
			if (variableType.kind === "ArrayType") {
				throw semanticError(`array variable requires index access: ${expr.text}`, expr);
			}
			return variableType;
		}
		case "IndexExpr": {
			const variableType = resolveVariable(ctx, expr.array.text);
			if (!variableType) {
				throw semanticError(
					`undefined variable: ${expr.array.text} (in ${ctx.sourceFilename})`,
					expr.array,
				);
			}
			if (variableType.kind !== "ArrayType" && variableType.kind !== "StringType") {
				throw semanticError(`index access requires array variable: ${expr.array.text}`, expr);
			}
			const indexType = typecheckExpr(expr.index, ctx);
			if (indexType.kind !== "IntType") {
				throw typeError(`array index must be int: ${expr.array.text}`, expr.index);
			}
			if (variableType.kind === "ArrayType") {
				return variableType.elementType;
			}
			return { kind: "CharType" };
		}
		case "CallExpr": {
			const signature = ctx.functions.get(expr.callee.text);
			if (!signature) {
				throw semanticError(`undefined function: ${expr.callee.text}`, expr.callee);
			}
			const fixedParamCount = signature.params.length;
			if (
				(!signature.isVariadic && fixedParamCount !== expr.args.length) ||
				(signature.isVariadic && expr.args.length < fixedParamCount)
			) {
				const expected = signature.isVariadic
					? `at least ${fixedParamCount}`
					: String(fixedParamCount);
				throw semanticError(
					`argument count mismatch for ${expr.callee.text}: expected ${expected}, got ${expr.args.length}`,
					expr,
				);
			}
			for (let i = 0; i < expr.args.length; i++) {
				const argType = typecheckExpr(expr.args[i]!, ctx);
				const expectedType = signature.params[i];
				if (expectedType && !isSameType(argType, expectedType)) {
					throw typeError(
						`argument type mismatch for ${expr.callee.text} at ${i + 1}: expected ${typeToString(expectedType)}, got ${typeToString(argType)}`,
						expr.args[i],
					);
				}
			}
			return signature.returnType;
		}
		case "BinaryExpr": {
			const left = typecheckExpr(expr.left, ctx);
			const right = typecheckExpr(expr.right, ctx);
			const op = expr.op;
			if (left.kind === "ArrayType" || right.kind === "ArrayType") {
				throw semanticError(`binary op ${op} does not support array operands`, expr);
			}
			if (
				left.kind === "StringType" ||
				right.kind === "StringType" ||
				left.kind === "CharType" ||
				right.kind === "CharType"
			) {
				throw semanticError(`binary op ${op} does not support string/char operands`, expr);
			}
			if (op === "+" || op === "-" || op === "*" || op === "/") {
				if (left.kind !== "IntType" || right.kind !== "IntType") {
					throw typeError(`binary op ${op} expects int operands`, expr);
				}
				return { kind: "IntType" };
			}
			if (op === "<" || op === "<=" || op === ">" || op === ">=") {
				if (left.kind !== "IntType" || right.kind !== "IntType") {
					throw typeError(`binary op ${op} expects int operands`, expr);
				}
				return { kind: "BoolType" };
			}
			if (!isSameType(left, right)) {
				throw typeError(`binary op ${op} expects matching operand types`, expr);
			}
			return { kind: "BoolType" };
		}
		case "CastExpr": {
			if (expr.targetType.kind === "ArrayType") {
				throw semanticError("cast to array type is not supported", expr);
			}
			if (expr.targetType.kind === "StringType" || expr.targetType.kind === "CharType") {
				throw semanticError("cast to string/char type is not supported", expr);
			}
			const valueType = typecheckExpr(expr.value, ctx);
			if (valueType.kind === "ArrayType") {
				throw semanticError("cast from array type is not supported", expr.value);
			}
			if (valueType.kind === "StringType" || valueType.kind === "CharType") {
				throw semanticError("cast from string/char type is not supported", expr.value);
			}
			if (isSameType(valueType, expr.targetType)) {
				return expr.targetType;
			}
			if (valueType.kind === "BoolType" && expr.targetType.kind === "IntType") {
				return { kind: "IntType" };
			}
			if (valueType.kind === "IntType" && expr.targetType.kind === "BoolType") {
				return { kind: "BoolType" };
			}
			throw typeError(
				`unsupported cast from ${typeToString(valueType)} to ${typeToString(expr.targetType)}`,
				expr,
			);
		}
	}
};
