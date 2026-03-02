import type { VarDeclStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { isSameType, llvmTypeFor, lowerExprToLlvm, typeToString } from "../expr.js";
import { currentScope } from "../scope.js";

export const lowerVarDeclStatement = (stmt: VarDeclStmt, ctx: FunctionEmitContext): string => {
	const scope = currentScope(ctx);
	const name = stmt.name.text;
	if (scope.has(name)) {
		throw new Error(`duplicate variable declaration: ${name}`);
	}

	const pointer = ctx.nextTemp();
	scope.set(name, { type: stmt.type, pointer });

	const llvmType = llvmTypeFor(stmt.type);
	let code = `  ${pointer} = alloca ${llvmType}\n`;
	if (stmt.type.kind === "ArrayType") {
		if (stmt.initializer) {
			throw new Error("array initializer is not supported yet");
		}
		code += `  store ${llvmType} zeroinitializer, ${llvmType}* ${pointer}\n`;
		return code;
	}

	if (stmt.initializer) {
		const lowered = lowerExprToLlvm(stmt.initializer, ctx);
		if (!isSameType(lowered.type, stmt.type)) {
			throw new Error(
				`variable initializer type mismatch: expected ${typeToString(stmt.type)}, got ${typeToString(lowered.type)}`,
			);
		}
		code += lowered.code;
		code += `  store ${llvmType} ${lowered.value}, ${llvmType}* ${pointer}\n`;
		return code;
	}

	const defaultValue = stmt.type.kind === "StringType" ? "null" : "0";
	code += `  store ${llvmType} ${defaultValue}, ${llvmType}* ${pointer}\n`;
	return code;
};
