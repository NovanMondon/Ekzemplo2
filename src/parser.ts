import * as antlr from "antlr4ng";

import type { Block, FunctionDecl, IntLiteral, Program, ReturnStmt } from "./ast.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type {
	BlockContext,
	FunctionDefinitionContext,
	ProgramContext,
	ReturnStatementContext,
} from "./generated/Ekzemplo2Parser.js";
import { Ekzemplo2ParserVisitor } from "./generated/Ekzemplo2ParserVisitor.js";

export class ThrowingErrorListener extends antlr.BaseErrorListener {
	public override syntaxError(
		_recognizer: antlr.Recognizer<antlr.ATNSimulator>,
		offendingSymbol: antlr.Token | null,
		line: number,
		charPositionInLine: number,
		msg: string,
		_e: antlr.RecognitionException | null,
	): void {
		const near = offendingSymbol?.text ? ` near '${offendingSymbol.text}'` : "";
		throw new SyntaxError(`line ${line}:${charPositionInLine} ${msg}${near}`);
	}
}

export const buildAst = (tree: ProgramContext): Program => {
	const visitor = new AstBuilder();
	const result = tree.accept(visitor);
	if (!result || result.kind !== "Program") {
		throw new Error("internal error: failed to build AST Program");
	}
	return result;
};

class AstBuilder extends Ekzemplo2ParserVisitor<Program | FunctionDecl | Block | ReturnStmt> {
	public override visitProgram = (ctx: ProgramContext): Program => {
		const fn = ctx.functionDefinition().accept(this);
		if (!fn || fn.kind !== "FunctionDecl") {
			throw new Error("internal error: expected FunctionDecl");
		}
		return { kind: "Program", functions: [fn] };
	};

	public override visitFunctionDefinition = (ctx: FunctionDefinitionContext): FunctionDecl => {
		const nameText = ctx.IDENT().getText();
		const body = ctx.block().accept(this);
		if (!body || body.kind !== "Block") {
			throw new Error("internal error: expected Block");
		}
		return {
			kind: "FunctionDecl",
			name: { kind: "Identifier", text: nameText },
			returnType: { kind: "IntType" },
			params: [],
			body,
		};
	};

	public override visitBlock = (ctx: BlockContext): Block => {
		const stmt = ctx.returnStatement().accept(this);
		if (!stmt || stmt.kind !== "ReturnStmt") {
			throw new Error("internal error: expected ReturnStmt");
		}
		return { kind: "Block", statements: [stmt] };
	};

	public override visitReturnStatement = (ctx: ReturnStatementContext): ReturnStmt => {
		const intText = ctx.INT().getText();
		const intLit: IntLiteral = parseIntLiteral(intText);
		return { kind: "ReturnStmt", value: intLit };
	};

	protected override defaultResult(): (Program | FunctionDecl | Block | ReturnStmt) | null {
		return null;
	}

	protected override aggregateResult(
		aggregate: (Program | FunctionDecl | Block | ReturnStmt) | null,
		nextResult: (Program | FunctionDecl | Block | ReturnStmt) | null,
	): (Program | FunctionDecl | Block | ReturnStmt) | null {
		return nextResult ?? aggregate;
	}

	protected override shouldVisitNextChild(
		_node: antlr.ParseTree,
		_currentResult: (Program | FunctionDecl | Block | ReturnStmt) | null,
	): boolean {
		// We build nodes in explicit visitX methods.
		return false;
	}
}

const parseIntLiteral = (text: string): IntLiteral => {
	const value = Number.parseInt(text, 10);
	if (!Number.isFinite(value)) {
		throw new SyntaxError(`invalid int literal: ${text}`);
	}
	return { kind: "IntLiteral", value, raw: text };
};

export const debugRuleNames = () => Ekzemplo2Parser.ruleNames;
export const debugSymbolicNames = () => Ekzemplo2Parser.symbolicNames;
