import type { FunctionDecl } from "../../frontend/ast.js";
import type { FunctionEmitContext, ModuleEmitContext } from "./env.js";
import { escapeLlvmIdentifier } from "./escape.js";
import { llvmTypeFor } from "./expr.js";
import { lowerStatements } from "./stmt/lowerStatements.js";
import { currentScope } from "./scope.js";

export const lowerMinimalFunction = (
	fn: FunctionDecl,
	ctx: ModuleEmitContext,
): { functionName: string; llvmIr: string } => {
	let tempCounter = 0;
	let labelCounter = 0;
	const nextTemp = () => `%t${tempCounter++}`;
	const nextLabel = (prefix: string) => `${prefix}.${labelCounter++}`;
	const fnCtx: FunctionEmitContext = { ...ctx, nextTemp, nextLabel, scopes: [new Map()] };
	const functionName = fn.name.text;
	let prologue = "";

	const paramDefs: string[] = [];
	for (let i = 0; i < fn.params.length; i++) {
		const param = fn.params[i]!;
		const llvmType = llvmTypeFor(param.type);
		const incoming = `%arg${i}`;
		paramDefs.push(`${llvmType} ${incoming}`);

		const scope = currentScope(fnCtx);
		if (scope.has(param.name.text)) {
			throw new Error(`duplicate parameter name: ${param.name.text}`);
		}
		const pointer = fnCtx.nextTemp();
		scope.set(param.name.text, { type: param.type, pointer });
		prologue += `  ${pointer} = alloca ${llvmType}\n`;
		prologue += `  store ${llvmType} ${incoming}, ${llvmType}* ${pointer}\n`;
	}

	const loweredBody = lowerStatements(fn.body.statements, fn.returnType, fnCtx);
	if (!loweredBody.terminated) {
		throw new Error("expected return statement");
	}
	const body = prologue + loweredBody.code;

	const returnLlvmType = llvmTypeFor(fn.returnType);
	return {
		functionName,
		llvmIr:
			`define ${returnLlvmType} @${escapeLlvmIdentifier(functionName)}(${paramDefs.join(", ")}) {\n` +
			"entry:\n" +
			body +
			"}\n\n",
	};
};
