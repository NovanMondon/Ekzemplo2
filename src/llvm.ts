import type { FunctionDecl, Program, ReturnStmt } from "./ast.js";

export const emitLlvmIR = (program: Program, sourceFilename = "input.ekz2"): string => {
	const fn = program.functions[0];
	if (!fn) {
		throw new Error("no function definitions");
	}
	const { functionName, returnValue } = lowerMinimalFunction(fn);

	// Minimal LLVM IR for: `int <name>() { return <int>; }`
	// We keep it intentionally small; clang can compile .ll directly.
	return [
		`; ModuleID = 'Ekzemplo2'`,
		`source_filename = "${escapeLlvmString(sourceFilename)}"`,
		"",
		`define i32 @${escapeLlvmIdentifier(functionName)}() {`,
		"entry:",
		`  ret i32 ${returnValue}`,
		"}",
		"",
	].join("\n");
};

const lowerMinimalFunction = (fn: FunctionDecl): { functionName: string; returnValue: number } => {
	if (fn.returnType.kind !== "IntType") {
		throw new Error("only int return type is supported");
	}
	const returnStmt = fn.body.statements[0];
	if (!returnStmt || returnStmt.kind !== "ReturnStmt") {
		throw new Error("expected return statement");
	}
	return {
		functionName: fn.name.text,
		returnValue: lowerReturnValue(returnStmt),
	};
};

const lowerReturnValue = (stmt: ReturnStmt): number => {
	const expr = stmt.value;
	if (expr.kind !== "IntLiteral") {
		throw new Error("only int literals are supported in return");
	}
	return expr.value;
};

const escapeLlvmIdentifier = (name: string): string => {
	// LLVM identifiers can be either: @name or @"name with spaces"
	// We keep it simple and quote if it contains characters outside [A-Za-z0-9_.$].
	return /^[A-Za-z0-9_.$]+$/.test(name) ? name : `"${escapeLlvmString(name)}"`;
};

const escapeLlvmString = (value: string): string => {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};
