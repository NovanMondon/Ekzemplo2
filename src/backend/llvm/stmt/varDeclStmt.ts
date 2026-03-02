import type { VarDeclStmt } from "../../../frontend/ast.js";
import type { FunctionEmitContext } from "../env.js";
import { llvmTypeFor, lowerExprToLlvm } from "../expr.js";
import { currentScope } from "../scope.js";

export const lowerVarDeclStatement = (stmt: VarDeclStmt, ctx: FunctionEmitContext): string => {
	const scope = currentScope(ctx);
	const name = stmt.name.text;

	const pointer = ctx.nextTemp();
	scope.set(name, { type: stmt.type, pointer });

	const llvmType = llvmTypeFor(stmt.type);
	let code = `  ${pointer} = alloca ${llvmType}\n`;
	if (stmt.type.kind === "ArrayType") {
		code += `  store ${llvmType} zeroinitializer, ${llvmType}* ${pointer}\n`;
		return code;
	}

	if (stmt.initializer) {
		const lowered = lowerExprToLlvm(stmt.initializer, ctx);
		code += lowered.code;
		code += `  store ${llvmType} ${lowered.value}, ${llvmType}* ${pointer}\n`;
		return code;
	}

	const defaultValue = stmt.type.kind === "StringType" ? "null" : "0";
	code += `  store ${llvmType} ${defaultValue}, ${llvmType}* ${pointer}\n`;
	return code;
};
