import type { FunctionDecl, Program } from "../../frontend/ast.js";
import { semanticError } from "../../diagnostics/compileDiagnostic.js";
import { currentScope } from "./scope.js";
import { typecheckStatements } from "./statements.js";
import type { FunctionSignature, TypecheckContext } from "./types.js";

export const typecheckProgram = (program: Program, sourceFilename = "<input>"): void => {
	if (program.functions.length === 0) {
		throw semanticError("no function definitions", program);
	}

	const functions = new Map<string, FunctionSignature>();
	for (const externFn of program.externs) {
		if (functions.has(externFn.name.text)) {
			throw semanticError(`duplicate function name: ${externFn.name.text}`, externFn);
		}
		functions.set(externFn.name.text, {
			returnType: externFn.returnType,
			params: externFn.params.map((p) => p.type),
			isVariadic: externFn.isVariadic,
		});
	}
	for (const fn of program.functions) {
		if (functions.has(fn.name.text)) {
			throw semanticError(`duplicate function name: ${fn.name.text}`, fn);
		}
		functions.set(fn.name.text, {
			returnType: fn.returnType,
			params: fn.params.map((p) => p.type),
			isVariadic: false,
		});
	}

	for (const fn of program.functions) {
		typecheckFunction(fn, {
			functions,
			scopes: [new Map()],
			loopDepth: 0,
			sourceFilename,
		});
	}
};

const typecheckFunction = (fn: FunctionDecl, ctx: TypecheckContext): void => {
	if (fn.returnType.kind === "ArrayType") {
		throw semanticError(`array return type is not supported: ${fn.name.text}`, fn);
	}

	const scope = currentScope(ctx);
	for (const param of fn.params) {
		if (param.type.kind === "ArrayType") {
			throw semanticError(`array parameter is not supported: ${param.name.text}`, param);
		}
		if (scope.has(param.name.text)) {
			throw semanticError(`duplicate parameter name: ${param.name.text}`, param);
		}
		scope.set(param.name.text, param.type);
	}

	const exit = typecheckStatements(fn.body.statements, fn.returnType, ctx);
	if (exit !== "return") {
		throw semanticError("expected return statement", fn);
	}
};
