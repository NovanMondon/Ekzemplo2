import type { BoolType, Expr, IntType, TypeNode } from "../../frontend/ast.js";
import type { FunctionEmitContext } from "./env.js";
import { escapeLlvmIdentifier } from "./escape.js";
import { resolveVariable } from "./scope.js";

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
		case "Identifier": {
			const binding = resolveVariable(ctx, expr.text);
			if (!binding) {
				throw new Error(`undefined variable: ${expr.text} (in ${ctx.sourceFilename})`);
			}
			const tmp = ctx.nextTemp();
			const llvmType = llvmTypeFor(binding.type);
			return {
				code: `  ${tmp} = load ${llvmType}, ${llvmType}* ${binding.pointer}\n`,
				value: tmp,
				type: binding.type,
			};
		}
		case "CallExpr": {
			const signature = ctx.functions.get(expr.callee.text);
			if (!signature) {
				throw new Error(`undefined function: ${expr.callee.text}`);
			}
			if (signature.params.length !== expr.args.length) {
				throw new Error(
					`argument count mismatch for ${expr.callee.text}: expected ${signature.params.length}, got ${expr.args.length}`,
				);
			}

			let code = "";
			const loweredArgs: string[] = [];
			for (let i = 0; i < expr.args.length; i++) {
				const lowered = lowerExprToLlvm(expr.args[i]!, ctx);
				const expectedType = signature.params[i]!;
				if (lowered.type.kind !== expectedType.kind) {
					throw new Error(
						`argument type mismatch for ${expr.callee.text} at ${i + 1}: expected ${typeToString(expectedType)}, got ${typeToString(lowered.type)}`,
					);
				}
				code += lowered.code;
				const llvmType = llvmTypeFor(expectedType);
				loweredArgs.push(`${llvmType} ${lowered.value}`);
			}

			const tmp = ctx.nextTemp();
			const returnLlvmType = llvmTypeFor(signature.returnType);
			code += `  ${tmp} = call ${returnLlvmType} @${escapeLlvmIdentifier(expr.callee.text)}(${loweredArgs.join(", ")})\n`;
			return {
				code,
				value: tmp,
				type: signature.returnType,
			};
		}
		default: {
			const _exhaustive: never = expr;
			return _exhaustive;
		}
	}
};
