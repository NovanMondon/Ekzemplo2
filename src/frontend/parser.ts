import * as antlr from "antlr4ng";

import type { Block, Expr, FunctionDecl, IntLiteral, Program, ReturnStmt } from "./ast.js";
import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type {
	AdditiveExprContext,
	BlockContext,
	ExprContext,
	FunctionDefinitionContext,
	PrimaryExprContext,
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

export type ParseProgramResult = {
	parser: Ekzemplo2Parser;
	tree: ProgramContext;
};

export const parseProgram = (sourceText: string): ParseProgramResult => {
	const errorListener = new ThrowingErrorListener();

	const input = antlr.CharStream.fromString(sourceText);
	const lexer = new Ekzemplo2Lexer(input);
	lexer.removeErrorListeners();
	lexer.addErrorListener(errorListener);

	const tokens = new antlr.CommonTokenStream(lexer);
	tokens.fill();
	const errorChars = tokens.getTokens().filter((t) => t.type === Ekzemplo2Lexer.ERROR_CHAR);
	if (errorChars.length > 0) {
		const first = errorChars[0]!;
		throw new SyntaxError(
			`unexpected character '${first.text ?? ""}' at line ${first.line}:${first.column}`,
		);
	}

	const parser = new Ekzemplo2Parser(tokens);
	parser.removeErrorListeners();
	parser.addErrorListener(errorListener);

	const tree = parser.program();
	return { parser, tree };
};

export const buildAst = (tree: ProgramContext): Program => {
	const visitor = new AstBuilder();
	const result = tree.accept(visitor);
	if (!result || result.kind !== "Program") {
		throw new Error("internal error: failed to build AST Program");
	}
	return result;
};

type AstResult = Program | FunctionDecl | Block | ReturnStmt | Expr;

class AstBuilder extends Ekzemplo2ParserVisitor<AstResult> {
	public override visitProgram = (ctx: ProgramContext): Program => {
		const fnsCtx = ctx.functionDefinition();
		const functions: FunctionDecl[] = [];
		for (const fnCtx of fnsCtx) {
			const fn = fnCtx.accept(this);
			if (!fn || fn.kind !== "FunctionDecl") {
				throw new Error("internal error: expected FunctionDecl");
			}
			functions.push(fn);
		}
		return { kind: "Program", functions };
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
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return { kind: "ReturnStmt", value };
	};

	public override visitExpr = (ctx: ExprContext): Expr => {
		const result = ctx.additiveExpr().accept(this);
		if (!result || !isExpr(result)) {
			throw new Error("internal error: expected Expr");
		}
		return result;
	};

	public override visitAdditiveExpr = (ctx: AdditiveExprContext): Expr => {
		const primaries = ctx.primaryExpr();
		if (primaries.length === 0) {
			throw new Error("internal error: expected at least one primaryExpr");
		}

		let acc = primaries[0]!.accept(this);
		if (!acc || !isExpr(acc)) {
			throw new Error("internal error: expected Expr");
		}

		for (let i = 1; i < primaries.length; i++) {
			const right = primaries[i]!.accept(this);
			if (!right || !isExpr(right)) {
				throw new Error("internal error: expected Expr");
			}
			acc = { kind: "BinaryExpr", op: "+", left: acc, right };
		}

		return acc;
	};

	public override visitPrimaryExpr = (ctx: PrimaryExprContext): Expr => {
		const intToken = ctx.INT();
		if (intToken) {
			return parseIntLiteral(intToken.getText());
		}
		const identToken = ctx.IDENT();
		if (identToken) {
			return { kind: "Identifier", text: identToken.getText() };
		}
		const inner = ctx.expr();
		if (inner) {
			const result = inner.accept(this);
			if (!result || !isExpr(result)) {
				throw new Error("internal error: expected Expr");
			}
			return result;
		}
		throw new Error("internal error: invalid primaryExpr");
	};

	protected override defaultResult(): AstResult | null {
		return null;
	}

	protected override aggregateResult(
		aggregate: AstResult | null,
		nextResult: AstResult | null,
	): AstResult | null {
		return nextResult ?? aggregate;
	}

	protected override shouldVisitNextChild(
		_node: antlr.ParseTree,
		_currentResult: AstResult | null,
	): boolean {
		// We build nodes in explicit visitX methods.
		return false;
	}
}

const isExpr = (node: AstResult): node is Expr => {
	return node.kind === "IntLiteral" || node.kind === "Identifier" || node.kind === "BinaryExpr";
};

const parseIntLiteral = (text: string): IntLiteral => {
	const value = Number.parseInt(text, 10);
	if (!Number.isFinite(value)) {
		throw new SyntaxError(`invalid int literal: ${text}`);
	}
	return { kind: "IntLiteral", value, raw: text };
};

export const debugRuleNames = () => Ekzemplo2Parser.ruleNames;
export const debugSymbolicNames = () => Ekzemplo2Parser.symbolicNames;
