import type { AssignStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { isSameType, llvmTypeFor, lowerExprToLlvm, typeToString } from "../expr.js";
import { resolveVariable } from "../scope.js";

export const lowerAssignStatement = (stmt: AssignStmt, ctx: FunctionEmitContext): string => {
	if (stmt.target.kind === "Identifier") {
		const binding = resolveVariable(ctx, stmt.target.text);
		if (!binding) {
			throw new Error(`undefined variable: ${stmt.target.text}`);
		}
		if (binding.type.kind === "ArrayType") {
			throw new Error(`array whole assignment is not supported: ${stmt.target.text}`);
		}

		const lowered = lowerExprToLlvm(stmt.value, ctx);
		if (!isSameType(lowered.type, binding.type)) {
			throw new Error(
				`assignment type mismatch: expected ${typeToString(binding.type)}, got ${typeToString(lowered.type)}`,
			);
		}

		const llvmType = llvmTypeFor(binding.type);
		return lowered.code + `  store ${llvmType} ${lowered.value}, ${llvmType}* ${binding.pointer}\n`;
	}

	const binding = resolveVariable(ctx, stmt.target.array.text);
	if (!binding) {
		throw new Error(`undefined variable: ${stmt.target.array.text}`);
	}
	if (binding.type.kind === "StringType") {
		throw new Error(`index assignment is not supported for string: ${stmt.target.array.text}`);
	}
	if (binding.type.kind !== "ArrayType") {
		throw new Error(`index assignment requires array variable: ${stmt.target.array.text}`);
	}

	const loweredIndex = lowerExprToLlvm(stmt.target.index, ctx);
	if (loweredIndex.type.kind !== "IntType") {
		throw new Error(`array index must be int: ${stmt.target.array.text}`);
	}

	const loweredValue = lowerExprToLlvm(stmt.value, ctx);
	if (!isSameType(loweredValue.type, binding.type.elementType)) {
		throw new Error(
			`assignment type mismatch: expected ${typeToString(binding.type.elementType)}, got ${typeToString(loweredValue.type)}`,
		);
	}

	const arrayLlvmType = llvmTypeFor(binding.type);
	const elementLlvmType = llvmTypeFor(binding.type.elementType);
	const elementPtr = ctx.nextTemp();
	return (
		loweredIndex.code +
		loweredValue.code +
		`  ${elementPtr} = getelementptr inbounds ${arrayLlvmType}, ${arrayLlvmType}* ${binding.pointer}, i32 0, i32 ${loweredIndex.value}\n` +
		`  store ${elementLlvmType} ${loweredValue.value}, ${elementLlvmType}* ${elementPtr}\n`
	);
};
