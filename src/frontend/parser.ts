import * as antlr from "antlr4ng";

import type {
	Block,
	BoolLiteral,
	Expr,
	FunctionDecl,
	IntLiteral,
	Program,
	ReturnStmt,
	TypeNode,
} from "./ast.js";
import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type {
	AdditiveExprContext,
	BlockContext,
	CastExprContext,
	EqualityExprContext,
	ExprContext,
	FunctionDefinitionContext,
	MultiplicativeExprContext,
	PrimaryExprContext,
	ProgramContext,
	RelationalExprContext,
	ReturnStatementContext,
	TypeNameContext,
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

type AstResult = Program | FunctionDecl | Block | ReturnStmt | Expr | TypeNode;

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
		const returnType = ctx.typeName().accept(this);
		if (!returnType || !isTypeNode(returnType)) {
			throw new Error("internal error: expected type name");
		}
		const body = ctx.block().accept(this);
		if (!body || body.kind !== "Block") {
			throw new Error("internal error: expected Block");
		}
		return {
			kind: "FunctionDecl",
			name: { kind: "Identifier", text: nameText },
			returnType,
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
		const result = ctx.equalityExpr().accept(this);
		if (!result || !isExpr(result)) {
			throw new Error("internal error: expected Expr");
		}
		return result;
	};

	public override visitEqualityExpr = (ctx: EqualityExprContext): Expr => {
		const parts = ctx.relationalExpr();
		return foldBinaryExprs(parts, this, ["==", "!="]);
	};

	public override visitRelationalExpr = (ctx: RelationalExprContext): Expr => {
		const parts = ctx.additiveExpr();
		return foldBinaryExprs(parts, this, ["<", "<=", ">", ">="]);
	};

	public override visitAdditiveExpr = (ctx: AdditiveExprContext): Expr => {
		const terms = ctx.multiplicativeExpr();
		return foldBinaryExprs(terms, this, ["+", "-"]);
	};

	public override visitMultiplicativeExpr = (ctx: MultiplicativeExprContext): Expr => {
		const parts = ctx.castExpr();
		return foldBinaryExprs(parts, this, ["*", "/"]);
	};

	public override visitCastExpr = (ctx: CastExprContext): Expr => {
		const typeName = ctx.typeName();
		if (typeName) {
			const targetType = typeName.accept(this);
			if (!targetType || !isTypeNode(targetType)) {
				throw new Error("internal error: expected type name");
			}
			const innerCtx = ctx.castExpr();
			if (!innerCtx) {
				throw new Error("internal error: expected castExpr");
			}
			const inner = innerCtx.accept(this);
			if (!inner || !isExpr(inner)) {
				throw new Error("internal error: expected Expr");
			}
			return { kind: "CastExpr", targetType, value: inner };
		}
		const primaryCtx = ctx.primaryExpr();
		if (!primaryCtx) {
			throw new Error("internal error: expected primaryExpr");
		}
		const primary = primaryCtx.accept(this);
		if (!primary || !isExpr(primary)) {
			throw new Error("internal error: expected Expr");
		}
		return primary;
	};

	public override visitPrimaryExpr = (ctx: PrimaryExprContext): Expr => {
		const intToken = ctx.INT();
		if (intToken) {
			return parseIntLiteral(intToken.getText());
		}
		const trueToken = ctx.KW_TRUE();
		if (trueToken) {
			return parseBoolLiteral(trueToken.getText());
		}
		const falseToken = ctx.KW_FALSE();
		if (falseToken) {
			return parseBoolLiteral(falseToken.getText());
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

	public override visitTypeName = (ctx: TypeNameContext): TypeNode => {
		const intToken = ctx.KW_INT();
		if (intToken) {
			return { kind: "IntType" };
		}
		const boolToken = ctx.KW_BOOL();
		if (boolToken) {
			return { kind: "BoolType" };
		}
		throw new Error("internal error: invalid typeName");
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
	return (
		node.kind === "IntLiteral" ||
		node.kind === "BoolLiteral" ||
		node.kind === "Identifier" ||
		node.kind === "BinaryExpr" ||
		node.kind === "CastExpr"
	);
};

const isTypeNode = (node: AstResult): node is TypeNode => {
	return node.kind === "IntType" || node.kind === "BoolType";
};

const parseIntLiteral = (text: string): IntLiteral => {
	const value = Number.parseInt(text, 10);
	if (!Number.isFinite(value)) {
		throw new SyntaxError(`invalid int literal: ${text}`);
	}
	return { kind: "IntLiteral", value, raw: text };
};

const parseBoolLiteral = (text: string): BoolLiteral => {
	if (text !== "true" && text !== "false") {
		throw new SyntaxError(`invalid bool literal: ${text}`);
	}
	return { kind: "BoolLiteral", value: text === "true", raw: text };
};

type BinaryOp = "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";

const foldBinaryExprs = (
	parts: antlr.ParserRuleContext[],
	visitor: AstBuilder,
	validOps: BinaryOp[],
): Expr => {
	if (parts.length === 0) {
		throw new Error("internal error: expected at least one expression part");
	}
	let acc = parts[0]!.accept(visitor);
	if (!acc || !isExpr(acc)) {
		throw new Error("internal error: expected Expr");
	}

	const ops = collectOps(parts[0]!, validOps);
	if (ops.length !== parts.length - 1) {
		throw new Error("internal error: operator/operand count mismatch");
	}

	for (let i = 1; i < parts.length; i++) {
		const right = parts[i]!.accept(visitor);
		if (!right || !isExpr(right)) {
			throw new Error("internal error: expected Expr");
		}
		acc = { kind: "BinaryExpr", op: ops[i - 1]!, left: acc, right };
	}

	return acc;
};

const collectOps = (
	firstPart: antlr.ParserRuleContext,
	validOps: BinaryOp[],
): BinaryOp[] => {
	const parent = firstPart.parent;
	if (!parent || !parent.children) {
		return [];
	}
	const ops: BinaryOp[] = [];
	for (const child of parent.children) {
		const text = child.getText?.();
		if (text && validOps.includes(text as BinaryOp)) {
			ops.push(text as BinaryOp);
		}
	}
	return ops;
};

export const debugRuleNames = () => Ekzemplo2Parser.ruleNames;
export const debugSymbolicNames = () => Ekzemplo2Parser.symbolicNames;
