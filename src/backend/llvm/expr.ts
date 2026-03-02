import type { BoolType, Expr, IntType, TypeNode } from "../../frontend/ast.js";
import type { FunctionEmitContext } from "./env.js";

export type LoweredExpr = {
	code: string;
	value: string;
	type: TypeNode;
};

const intType: IntType = { kind: "IntType" };
const boolType: BoolType = { kind: "BoolType" };

export const llvmTypeFor = (type: TypeNode): "i32" | "i1" => {
	return type.kind === "IntType" ? "i32" : "i1";
};

export const typeToString = (type: TypeNode): "int" | "bool" => {
	return type.kind === "IntType" ? "int" : "bool";
};

export const lowerExprToLlvm = (expr: Expr, ctx: FunctionEmitContext): LoweredExpr => {
	switch (expr.kind) {
		case "IntLiteral":
			return { code: "", value: String(expr.value), type: intType };
		case "BoolLiteral":
			return { code: "", value: expr.value ? "1" : "0", type: boolType };
		case "CastExpr": {
			const inner = lowerExprToLlvm(expr.value, ctx);
			if (inner.type.kind === expr.targetType.kind) {
				return { code: inner.code, value: inner.value, type: expr.targetType };
			}
			if (expr.targetType.kind === "IntType" && inner.type.kind === "BoolType") {
				const tmp = ctx.nextTemp();
				return {
					code: inner.code + `  ${tmp} = zext i1 ${inner.value} to i32\n`,
					value: tmp,
					type: intType,
				};
			}
			if (expr.targetType.kind === "BoolType" && inner.type.kind === "IntType") {
				const tmp = ctx.nextTemp();
				return {
					code: inner.code + `  ${tmp} = icmp ne i32 ${inner.value}, 0\n`,
					value: tmp,
					type: boolType,
				};
			}
			throw new Error(
				`unsupported cast from ${typeToString(inner.type)} to ${typeToString(expr.targetType)}`,
			);
		}
		case "BinaryExpr": {
			const left = lowerExprToLlvm(expr.left, ctx);
			const right = lowerExprToLlvm(expr.right, ctx);
			const tmp = ctx.nextTemp();
			const op = expr.op;
			if (op === "+" || op === "-" || op === "*" || op === "/") {
				if (left.type.kind !== "IntType" || right.type.kind !== "IntType") {
					throw new Error(`binary op ${op} expects int operands`);
				}
				const instr = op === "+" ? "add" : op === "-" ? "sub" : op === "*" ? "mul" : "sdiv";
				return {
					code: left.code + right.code + `  ${tmp} = ${instr} i32 ${left.value}, ${right.value}\n`,
					value: tmp,
					type: intType,
				};
			}
			const isEquality = op === "==" || op === "!=";
			const isRelational = op === "<" || op === "<=" || op === ">" || op === ">=";
			if (!isEquality && !isRelational) {
				throw new Error(`unsupported binary op: ${expr.op}`);
			}
			if (isRelational && (left.type.kind !== "IntType" || right.type.kind !== "IntType")) {
				throw new Error(`binary op ${op} expects int operands`);
			}
			if (isEquality && left.type.kind !== right.type.kind) {
				throw new Error(`binary op ${op} expects matching operand types`);
			}
			const llvmType = llvmTypeFor(left.type);
			const cond =
				op === "=="
					? "eq"
					: op === "!="
						? "ne"
						: op === "<"
							? "slt"
							: op === "<="
								? "sle"
								: op === ">"
									? "sgt"
									: "sge";
			return {
				code:
					left.code +
					right.code +
					`  ${tmp} = icmp ${cond} ${llvmType} ${left.value}, ${right.value}\n`,
				value: tmp,
				type: boolType,
			};
		}
		case "Identifier":
			throw new Error(
				`identifiers are not supported in expressions yet (in ${ctx.sourceFilename})`,
			);
		default: {
			const _exhaustive: never = expr;
			return _exhaustive;
		}
	}
};
