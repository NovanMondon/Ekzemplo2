import * as antlr from "antlr4ng";

import type {
	AssignStmt,
	Block,
	BoolLiteral,
	BreakStmt,
	ContinueStmt,
	Expr,
	ExprStmt,
	ForStmt,
	FunctionDecl,
	IfStmt,
	IntLiteral,
	ParamDecl,
	Program,
	ReturnStmt,
	Statement,
	TypeNode,
	VarDeclStmt,
	WhileStmt,
} from "./ast.js";
import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type {
	AdditiveExprContext,
	ArgumentListContext,
	AssignmentStatementContext,
	BlockContext,
	BreakStatementContext,
	CastExprContext,
	ContinueStatementContext,
	EqualityExprContext,
	ExpressionStatementContext,
	ExprContext,
	ForInitContext,
	ForStatementContext,
	ForUpdateContext,
	FunctionDefinitionContext,
	IfStatementContext,
	MultiplicativeExprContext,
	ParameterContext,
	PrimaryExprContext,
	ProgramContext,
	RelationalExprContext,
	ReturnStatementContext,
	StatementContext,
	TypeNameContext,
	VariableDeclarationContext,
	WhileStatementContext,
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

type AstResult = Program | FunctionDecl | ParamDecl | Block | Statement | Expr | TypeNode;

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
		const params: ParamDecl[] = [];
		const parameterList = ctx.parameterList();
		if (parameterList) {
			for (const paramCtx of parameterList.parameter()) {
				const param = paramCtx.accept(this);
				if (!param || param.kind !== "ParamDecl") {
					throw new Error("internal error: expected ParamDecl");
				}
				params.push(param);
			}
		}
		const body = ctx.block().accept(this);
		if (!body || body.kind !== "Block") {
			throw new Error("internal error: expected Block");
		}
		return {
			kind: "FunctionDecl",
			name: { kind: "Identifier", text: nameText },
			returnType,
			params,
			body,
		};
	};

	public override visitParameter = (ctx: ParameterContext): ParamDecl => {
		const type = ctx.typeName().accept(this);
		if (!type || !isTypeNode(type)) {
			throw new Error("internal error: expected type name");
		}
		return {
			kind: "ParamDecl",
			name: { kind: "Identifier", text: ctx.IDENT().getText() },
			type,
		};
	};

	public override visitBlock = (ctx: BlockContext): Block => {
		const statements: Statement[] = [];
		for (const stmtCtx of ctx.statement()) {
			const stmt = stmtCtx.accept(this);
			if (!stmt || !isStatement(stmt)) {
				throw new Error("internal error: expected Statement");
			}
			statements.push(stmt);
		}
		return { kind: "Block", statements };
	};

	public override visitStatement = (ctx: StatementContext): Statement => {
		const varDecl = ctx.variableDeclaration();
		if (varDecl) {
			const stmt = varDecl.accept(this);
			if (!stmt || stmt.kind !== "VarDeclStmt") {
				throw new Error("internal error: expected VarDeclStmt");
			}
			return stmt;
		}

		const assign = ctx.assignmentStatement();
		if (assign) {
			const stmt = assign.accept(this);
			if (!stmt || stmt.kind !== "AssignStmt") {
				throw new Error("internal error: expected AssignStmt");
			}
			return stmt;
		}

		const ret = ctx.returnStatement();
		if (ret) {
			const stmt = ret.accept(this);
			if (!stmt || stmt.kind !== "ReturnStmt") {
				throw new Error("internal error: expected ReturnStmt");
			}
			return stmt;
		}

		const ifStmt = ctx.ifStatement();
		if (ifStmt) {
			const stmt = ifStmt.accept(this);
			if (!stmt || stmt.kind !== "IfStmt") {
				throw new Error("internal error: expected IfStmt");
			}
			return stmt;
		}

		const whileStmt = ctx.whileStatement();
		if (whileStmt) {
			const stmt = whileStmt.accept(this);
			if (!stmt || stmt.kind !== "WhileStmt") {
				throw new Error("internal error: expected WhileStmt");
			}
			return stmt;
		}

		const forStmt = ctx.forStatement();
		if (forStmt) {
			const stmt = forStmt.accept(this);
			if (!stmt || stmt.kind !== "ForStmt") {
				throw new Error("internal error: expected ForStmt");
			}
			return stmt;
		}

		const breakStmt = ctx.breakStatement();
		if (breakStmt) {
			const stmt = breakStmt.accept(this);
			if (!stmt || stmt.kind !== "BreakStmt") {
				throw new Error("internal error: expected BreakStmt");
			}
			return stmt;
		}

		const continueStmt = ctx.continueStatement();
		if (continueStmt) {
			const stmt = continueStmt.accept(this);
			if (!stmt || stmt.kind !== "ContinueStmt") {
				throw new Error("internal error: expected ContinueStmt");
			}
			return stmt;
		}

		const exprStmt = ctx.expressionStatement();
		if (exprStmt) {
			const stmt = exprStmt.accept(this);
			if (!stmt || stmt.kind !== "ExprStmt") {
				throw new Error("internal error: expected ExprStmt");
			}
			return stmt;
		}

		const block = ctx.block();
		if (block) {
			const stmt = block.accept(this);
			if (!stmt || stmt.kind !== "Block") {
				throw new Error("internal error: expected Block");
			}
			return stmt;
		}

		throw new Error("internal error: invalid statement");
	};

	public override visitExpressionStatement = (ctx: ExpressionStatementContext): ExprStmt => {
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return { kind: "ExprStmt", value };
	};

	public override visitVariableDeclaration = (ctx: VariableDeclarationContext): VarDeclStmt => {
		const type = ctx.typeName().accept(this);
		if (!type || !isTypeNode(type)) {
			throw new Error("internal error: expected type name");
		}
		const ident = ctx.IDENT().getText();
		const initializerCtx = ctx.expr();
		if (initializerCtx) {
			const initializer = initializerCtx.accept(this);
			if (!initializer || !isExpr(initializer)) {
				throw new Error("internal error: expected Expr");
			}
			return {
				kind: "VarDeclStmt",
				name: { kind: "Identifier", text: ident },
				type,
				initializer,
			};
		}
		return {
			kind: "VarDeclStmt",
			name: { kind: "Identifier", text: ident },
			type,
		};
	};

	public override visitAssignmentStatement = (ctx: AssignmentStatementContext): AssignStmt => {
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return {
			kind: "AssignStmt",
			target: { kind: "Identifier", text: ctx.IDENT().getText() },
			value,
		};
	};

	public override visitReturnStatement = (ctx: ReturnStatementContext): ReturnStmt => {
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return { kind: "ReturnStmt", value };
	};

	public override visitIfStatement = (ctx: IfStatementContext): IfStmt => {
		const condition = ctx.expr().accept(this);
		if (!condition || !isExpr(condition)) {
			throw new Error("internal error: expected Expr");
		}
		const thenBranchCtx = ctx.statement(0);
		if (!thenBranchCtx) {
			throw new Error("internal error: expected then statement");
		}
		const thenBranch = thenBranchCtx.accept(this);
		if (!thenBranch || !isStatement(thenBranch)) {
			throw new Error("internal error: expected Statement");
		}

		const elseBranchCtx = ctx.statement(1);
		if (elseBranchCtx) {
			const elseBranch = elseBranchCtx.accept(this);
			if (!elseBranch || !isStatement(elseBranch)) {
				throw new Error("internal error: expected Statement");
			}
			return { kind: "IfStmt", condition, thenBranch, elseBranch };
		}

		return { kind: "IfStmt", condition, thenBranch };
	};

	public override visitForStatement = (ctx: ForStatementContext): ForStmt => {
		const init = this.buildForInit(ctx.forInit());
		const conditionCtx = ctx.expr();
		let condition: Expr | undefined;
		if (conditionCtx) {
			const parsed = conditionCtx.accept(this);
			if (!parsed || !isExpr(parsed)) {
				throw new Error("internal error: expected Expr");
			}
			condition = parsed;
		}
		const update = this.buildForUpdate(ctx.forUpdate());

		const bodyCtx = ctx.statement();
		if (!bodyCtx) {
			throw new Error("internal error: expected statement");
		}
		const body = bodyCtx.accept(this);
		if (!body || !isStatement(body)) {
			throw new Error("internal error: expected Statement");
		}

		return { kind: "ForStmt", init, condition, update, body };
	};

	public override visitWhileStatement = (ctx: WhileStatementContext): WhileStmt => {
		const condition = ctx.expr().accept(this);
		if (!condition || !isExpr(condition)) {
			throw new Error("internal error: expected Expr");
		}
		const bodyCtx = ctx.statement();
		if (!bodyCtx) {
			throw new Error("internal error: expected statement");
		}
		const body = bodyCtx.accept(this);
		if (!body || !isStatement(body)) {
			throw new Error("internal error: expected Statement");
		}
		return { kind: "WhileStmt", condition, body };
	};

	public override visitBreakStatement = (_ctx: BreakStatementContext): BreakStmt => {
		return { kind: "BreakStmt" };
	};

	public override visitContinueStatement = (_ctx: ContinueStatementContext): ContinueStmt => {
		return { kind: "ContinueStmt" };
	};

	private buildForInit(ctx: ForInitContext | null): ForStmt["init"] {
		if (!ctx) {
			return undefined;
		}
		const typeName = ctx.typeName();
		if (typeName) {
			const type = typeName.accept(this);
			if (!type || !isTypeNode(type)) {
				throw new Error("internal error: expected type name");
			}
			const nameToken = ctx.IDENT();
			if (!nameToken) {
				throw new Error("internal error: expected identifier");
			}
			const initExprCtx = ctx.expr();
			if (initExprCtx) {
				const initializer = initExprCtx.accept(this);
				if (!initializer || !isExpr(initializer)) {
					throw new Error("internal error: expected Expr");
				}
				return {
					kind: "VarDeclStmt",
					name: { kind: "Identifier", text: nameToken.getText() },
					type,
					initializer,
				};
			}
			return {
				kind: "VarDeclStmt",
				name: { kind: "Identifier", text: nameToken.getText() },
				type,
			};
		}

		const identToken = ctx.IDENT();
		const assignToken = ctx.ASSIGN();
		if (identToken && assignToken) {
			const value = ctx.expr();
			if (!value) {
				throw new Error("internal error: expected Expr");
			}
			const parsed = value.accept(this);
			if (!parsed || !isExpr(parsed)) {
				throw new Error("internal error: expected Expr");
			}
			return {
				kind: "AssignStmt",
				target: { kind: "Identifier", text: identToken.getText() },
				value: parsed,
			};
		}

		const exprCtx = ctx.expr();
		if (!exprCtx) {
			throw new Error("internal error: expected Expr");
		}
		const value = exprCtx.accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return { kind: "ExprStmt", value };
	}

	private buildForUpdate(ctx: ForUpdateContext | null): ForStmt["update"] {
		if (!ctx) {
			return undefined;
		}

		const identToken = ctx.IDENT();
		const assignToken = ctx.ASSIGN();
		if (identToken && assignToken) {
			const value = ctx.expr();
			if (!value) {
				throw new Error("internal error: expected Expr");
			}
			const parsed = value.accept(this);
			if (!parsed || !isExpr(parsed)) {
				throw new Error("internal error: expected Expr");
			}
			return {
				kind: "AssignStmt",
				target: { kind: "Identifier", text: identToken.getText() },
				value: parsed,
			};
		}

		const exprCtx = ctx.expr();
		if (!exprCtx) {
			throw new Error("internal error: expected Expr");
		}
		const value = exprCtx.accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return { kind: "ExprStmt", value };
	}

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
			if (ctx.LPAREN() && ctx.RPAREN()) {
				const argumentList = ctx.argumentList();
				return {
					kind: "CallExpr",
					callee: { kind: "Identifier", text: identToken.getText() },
					args: argumentList ? this.buildArgumentList(argumentList) : [],
				};
			}
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

	private buildArgumentList(argumentList: ArgumentListContext): Expr[] {
		const args: Expr[] = [];
		for (const argCtx of argumentList.expr()) {
			const arg = argCtx.accept(this);
			if (!arg || !isExpr(arg)) {
				throw new Error("internal error: expected Expr");
			}
			args.push(arg);
		}
		return args;
	}

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
		node.kind === "CastExpr" ||
		node.kind === "CallExpr"
	);
};

const isTypeNode = (node: AstResult): node is TypeNode => {
	return node.kind === "IntType" || node.kind === "BoolType";
};

const isStatement = (node: AstResult): node is Statement => {
	return (
		node.kind === "VarDeclStmt" ||
		node.kind === "AssignStmt" ||
		node.kind === "ExprStmt" ||
		node.kind === "IfStmt" ||
		node.kind === "ForStmt" ||
		node.kind === "WhileStmt" ||
		node.kind === "BreakStmt" ||
		node.kind === "ContinueStmt" ||
		node.kind === "ReturnStmt" ||
		node.kind === "Block"
	);
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

const collectOps = (firstPart: antlr.ParserRuleContext, validOps: BinaryOp[]): BinaryOp[] => {
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
