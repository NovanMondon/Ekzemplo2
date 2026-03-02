import type { AssignStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { llvmTypeFor, lowerExprToLlvm } from "../expr.js";
import { resolveVariable } from "../scope.js";

export const lowerAssignStatement = (stmt: AssignStmt, ctx: FunctionEmitContext): string => {
	if (stmt.target.kind === "Identifier") {
		const binding = resolveVariable(ctx, stmt.target.text)!;
		const lowered = lowerExprToLlvm(stmt.value, ctx);

		const llvmType = llvmTypeFor(binding.type);
		return lowered.code + `  store ${llvmType} ${lowered.value}, ${llvmType}* ${binding.pointer}\n`;
	}

	const binding = resolveVariable(ctx, stmt.target.array.text)!;
	const arrayType = binding.type as Extract<typeof binding.type, { kind: "ArrayType" }>;
	const loweredIndex = lowerExprToLlvm(stmt.target.index, ctx);
	const loweredValue = lowerExprToLlvm(stmt.value, ctx);

	const arrayLlvmType = llvmTypeFor(arrayType);
	const elementLlvmType = llvmTypeFor(arrayType.elementType);
	const elementPtr = ctx.nextTemp();
	return (
		loweredIndex.code +
		loweredValue.code +
		`  ${elementPtr} = getelementptr inbounds ${arrayLlvmType}, ${arrayLlvmType}* ${binding.pointer}, i32 0, i32 ${loweredIndex.value}\n` +
		`  store ${elementLlvmType} ${loweredValue.value}, ${elementLlvmType}* ${elementPtr}\n`
	);
};
