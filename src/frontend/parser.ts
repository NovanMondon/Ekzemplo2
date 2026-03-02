import * as antlr from "antlr4ng";

import type {
	AssignStmt,
	Block,
	BoolLiteral,
	BoolType,
	BreakStmt,
	CharLiteral,
	CharType,
	ContinueStmt,
	Expr,
	ExprStmt,
	ExternFunctionDecl,
	ForStmt,
	FunctionDecl,
	IfStmt,
	IntLiteral,
	IntType,
	ParamDecl,
	Program,
	ReturnStmt,
	StringLiteral,
	StringType,
	Statement,
	TypeNode,
	VarDeclStmt,
	WhileStmt,
} from "./ast.js";
import { CompileDiagnosticError } from "../diagnostics/compileDiagnostic.js";
import type { SourceLocation } from "./sourceLocation.js";
import { Ekzemplo2Lexer } from "./generated/Ekzemplo2Lexer.js";
import { Ekzemplo2Parser } from "./generated/Ekzemplo2Parser.js";
import type {
	AdditiveExprContext,
	AssignTargetContext,
	ArgumentListContext,
	AssignmentStatementContext,
	BlockContext,
	BreakStatementContext,
	CastExprContext,
	ContinueStatementContext,
	EqualityExprContext,
	ExpressionStatementContext,
	ExprContext,
	ExternParameterSpecContext,
	ExternFunctionDeclarationContext,
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
	TopLevelDeclarationContext,
	TypeNameContext,
	VariableDeclarationContext,
	WhileStatementContext,
} from "./generated/Ekzemplo2Parser.js";
import { Ekzemplo2ParserVisitor } from "./generated/Ekzemplo2ParserVisitor.js";

export class ThrowingErrorListener extends antlr.BaseErrorListener {
	public constructor(private readonly sourceName: string) {
		super();
	}

	public override syntaxError(
		_recognizer: antlr.Recognizer<antlr.ATNSimulator>,
		offendingSymbol: antlr.Token | null,
		line: number,
		charPositionInLine: number,
		msg: string,
		_e: antlr.RecognitionException | null,
	): void {
		throw new CompileDiagnosticError("syntax", msg, {
			location: {
				line,
				column: charPositionInLine,
				sourceName: this.sourceName,
			},
			nearText: offendingSymbol?.text ?? undefined,
		});
	}
}

export type ParseProgramResult = {
	parser: Ekzemplo2Parser;
	tree: ProgramContext;
};

export const parseProgram = (sourceText: string, sourceName = "<input>"): ParseProgramResult => {
	const errorListener = new ThrowingErrorListener(sourceName);

	const input = antlr.CharStream.fromString(sourceText);
	const lexer = new Ekzemplo2Lexer(input);
	lexer.removeErrorListeners();
	lexer.addErrorListener(errorListener);

	const tokens = new antlr.CommonTokenStream(lexer);
	tokens.fill();
	const errorChars = tokens.getTokens().filter((t) => t.type === Ekzemplo2Lexer.ERROR_CHAR);
	if (errorChars.length > 0) {
		const first = errorChars[0]!;
		throw new CompileDiagnosticError("syntax", `unexpected character '${first.text ?? ""}'`, {
			location: tokenLocation(first, sourceName),
			nearText: first.text ?? undefined,
		});
	}

	const parser = new Ekzemplo2Parser(tokens);
	parser.removeErrorListeners();
	parser.addErrorListener(errorListener);

	const tree = parser.program();
	return { parser, tree };
};

export const buildAst = (tree: ProgramContext, sourceName = "<input>"): Program => {
	const visitor = new AstBuilder(sourceName);
	const result = tree.accept(visitor);
	if (!result || result.kind !== "Program") {
		throw new Error("internal error: failed to build AST Program");
	}
	return result;
};

type AstResult =
	| Program
	| ExternFunctionDecl
	| FunctionDecl
	| ParamDecl
	| Block
	| Statement
	| Expr
	| TypeNode;

class AstBuilder extends Ekzemplo2ParserVisitor<AstResult> {
	public constructor(private readonly sourceName: string) {
		super();
	}

	public override visitProgram = (ctx: ProgramContext): Program => {
		const externs: ExternFunctionDecl[] = [];
		const functions: FunctionDecl[] = [];
		for (const topLevelDecl of ctx.topLevelDeclaration()) {
			const decl = topLevelDecl.accept(this);
			if (!decl) {
				throw new Error("internal error: expected top-level declaration");
			}
			if (decl.kind === "ExternFunctionDecl") {
				externs.push(decl);
				continue;
			}
			if (decl.kind === "FunctionDecl") {
				functions.push(decl);
				continue;
			}
			throw new Error("internal error: expected FunctionDecl or ExternFunctionDecl");
		}
		return withLoc({ kind: "Program", externs, functions }, ctx, this.sourceName);
	};

	public override visitTopLevelDeclaration = (ctx: TopLevelDeclarationContext): AstResult => {
		const externDecl = ctx.externFunctionDeclaration();
		if (externDecl) {
			const result = externDecl.accept(this);
			if (!result || result.kind !== "ExternFunctionDecl") {
				throw new Error("internal error: expected ExternFunctionDecl");
			}
			return result;
		}

		const fnDecl = ctx.functionDefinition();
		if (fnDecl) {
			const result = fnDecl.accept(this);
			if (!result || result.kind !== "FunctionDecl") {
				throw new Error("internal error: expected FunctionDecl");
			}
			return result;
		}

		throw new Error("internal error: invalid top-level declaration");
	};

	public override visitExternFunctionDeclaration = (
		ctx: ExternFunctionDeclarationContext,
	): ExternFunctionDecl => {
		const nameText = ctx.IDENT().getText();
		const returnType = ctx.typeName().accept(this);
		if (!returnType || !isTypeNode(returnType)) {
			throw new Error("internal error: expected type name");
		}
		if (returnType.kind === "ArrayType") {
			throw new Error("array return type is not supported yet");
		}

		const params: ParamDecl[] = [];
		const externParameterSpec = ctx.externParameterSpec();
		const isVariadic = this.isExternVariadic(externParameterSpec);
		const parameterList = externParameterSpec?.parameterList();
		if (parameterList) {
			for (const paramCtx of parameterList.parameter()) {
				const param = paramCtx.accept(this);
				if (!param || param.kind !== "ParamDecl") {
					throw new Error("internal error: expected ParamDecl");
				}
				params.push(param);
			}
		}

		return withLoc(
			{
				kind: "ExternFunctionDecl",
				name: withLoc({ kind: "Identifier", text: nameText }, ctx.IDENT(), this.sourceName),
				returnType,
				params,
				isVariadic,
			},
			ctx,
			this.sourceName,
		);
	};

	private isExternVariadic(ctx: ExternParameterSpecContext | null): boolean {
		if (!ctx) {
			return false;
		}
		return ctx.ELLIPSIS() !== null;
	}

	public override visitFunctionDefinition = (ctx: FunctionDefinitionContext): FunctionDecl => {
		const nameText = ctx.IDENT().getText();
		const returnType = ctx.typeName().accept(this);
		if (!returnType || !isTypeNode(returnType)) {
			throw new Error("internal error: expected type name");
		}
		if (returnType.kind === "ArrayType") {
			throw new Error("array return type is not supported yet");
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
		return withLoc(
			{
				kind: "FunctionDecl",
				name: withLoc({ kind: "Identifier", text: nameText }, ctx.IDENT(), this.sourceName),
				returnType,
				params,
				body,
			},
			ctx,
			this.sourceName,
		);
	};

	public override visitParameter = (ctx: ParameterContext): ParamDecl => {
		const type = ctx.typeName().accept(this);
		if (!type || !isTypeNode(type)) {
			throw new Error("internal error: expected type name");
		}
		if (type.kind === "ArrayType") {
			throw new Error("array parameter is not supported yet");
		}
		return withLoc(
			{
				kind: "ParamDecl",
				name: withLoc(
					{ kind: "Identifier", text: ctx.IDENT().getText() },
					ctx.IDENT(),
					this.sourceName,
				),
				type,
			},
			ctx,
			this.sourceName,
		);
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
		return withLoc({ kind: "Block", statements }, ctx, this.sourceName);
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
		return withLoc({ kind: "ExprStmt", value }, ctx, this.sourceName);
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
			return withLoc(
				{
					kind: "VarDeclStmt",
					name: withLoc({ kind: "Identifier", text: ident }, ctx.IDENT(), this.sourceName),
					type,
					initializer,
				},
				ctx,
				this.sourceName,
			);
		}
		return withLoc(
			{
				kind: "VarDeclStmt",
				name: withLoc({ kind: "Identifier", text: ident }, ctx.IDENT(), this.sourceName),
				type,
			},
			ctx,
			this.sourceName,
		);
	};

	public override visitAssignmentStatement = (ctx: AssignmentStatementContext): AssignStmt => {
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		const targetCtx = ctx.assignTarget();
		if (!targetCtx) {
			throw new Error("internal error: expected assignTarget");
		}
		return withLoc(
			{
				kind: "AssignStmt",
				target: this.buildAssignTarget(targetCtx),
				value,
			},
			ctx,
			this.sourceName,
		);
	};

	public override visitReturnStatement = (ctx: ReturnStatementContext): ReturnStmt => {
		const value = ctx.expr().accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return withLoc({ kind: "ReturnStmt", value }, ctx, this.sourceName);
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
			return withLoc({ kind: "IfStmt", condition, thenBranch, elseBranch }, ctx, this.sourceName);
		}

		return withLoc({ kind: "IfStmt", condition, thenBranch }, ctx, this.sourceName);
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

		return withLoc({ kind: "ForStmt", init, condition, update, body }, ctx, this.sourceName);
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
		return withLoc({ kind: "WhileStmt", condition, body }, ctx, this.sourceName);
	};

	public override visitBreakStatement = (ctx: BreakStatementContext): BreakStmt => {
		return withLoc({ kind: "BreakStmt" }, ctx, this.sourceName);
	};

	public override visitContinueStatement = (ctx: ContinueStatementContext): ContinueStmt => {
		return withLoc({ kind: "ContinueStmt" }, ctx, this.sourceName);
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
				return withLoc(
					{
						kind: "VarDeclStmt",
						name: withLoc(
							{ kind: "Identifier", text: nameToken.getText() },
							nameToken,
							this.sourceName,
						),
						type,
						initializer,
					},
					ctx,
					this.sourceName,
				);
			}
			return withLoc(
				{
					kind: "VarDeclStmt",
					name: withLoc(
						{ kind: "Identifier", text: nameToken.getText() },
						nameToken,
						this.sourceName,
					),
					type,
				},
				ctx,
				this.sourceName,
			);
		}

		const targetCtx = ctx.assignTarget();
		if (targetCtx && ctx.ASSIGN()) {
			const value = ctx.expr();
			if (!value) {
				throw new Error("internal error: expected Expr");
			}
			const parsed = value.accept(this);
			if (!parsed || !isExpr(parsed)) {
				throw new Error("internal error: expected Expr");
			}
			return withLoc(
				{
					kind: "AssignStmt",
					target: this.buildAssignTarget(targetCtx),
					value: parsed,
				},
				ctx,
				this.sourceName,
			);
		}

		const exprCtx = ctx.expr();
		if (!exprCtx) {
			throw new Error("internal error: expected Expr");
		}
		const value = exprCtx.accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return withLoc({ kind: "ExprStmt", value }, ctx, this.sourceName);
	}

	private buildForUpdate(ctx: ForUpdateContext | null): ForStmt["update"] {
		if (!ctx) {
			return undefined;
		}

		const targetCtx = ctx.assignTarget();
		if (targetCtx && ctx.ASSIGN()) {
			const value = ctx.expr();
			if (!value) {
				throw new Error("internal error: expected Expr");
			}
			const parsed = value.accept(this);
			if (!parsed || !isExpr(parsed)) {
				throw new Error("internal error: expected Expr");
			}
			return withLoc(
				{
					kind: "AssignStmt",
					target: this.buildAssignTarget(targetCtx),
					value: parsed,
				},
				ctx,
				this.sourceName,
			);
		}

		const exprCtx = ctx.expr();
		if (!exprCtx) {
			throw new Error("internal error: expected Expr");
		}
		const value = exprCtx.accept(this);
		if (!value || !isExpr(value)) {
			throw new Error("internal error: expected Expr");
		}
		return withLoc({ kind: "ExprStmt", value }, ctx, this.sourceName);
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
		return foldBinaryExprs(parts, this, ["==", "!="], ctx, this.sourceName);
	};

	public override visitRelationalExpr = (ctx: RelationalExprContext): Expr => {
		const parts = ctx.additiveExpr();
		return foldBinaryExprs(parts, this, ["<", "<=", ">", ">="], ctx, this.sourceName);
	};

	public override visitAdditiveExpr = (ctx: AdditiveExprContext): Expr => {
		const terms = ctx.multiplicativeExpr();
		return foldBinaryExprs(terms, this, ["+", "-"], ctx, this.sourceName);
	};

	public override visitMultiplicativeExpr = (ctx: MultiplicativeExprContext): Expr => {
		const parts = ctx.castExpr();
		return foldBinaryExprs(parts, this, ["*", "/"], ctx, this.sourceName);
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
			return withLoc({ kind: "CastExpr", targetType, value: inner }, ctx, this.sourceName);
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
			return parseIntLiteral(intToken, this.sourceName);
		}
		const stringToken = ctx.STRING_LITERAL();
		if (stringToken) {
			return parseStringLiteral(stringToken, this.sourceName);
		}
		const charToken = ctx.CHAR_LITERAL();
		if (charToken) {
			return parseCharLiteral(charToken, this.sourceName);
		}
		const trueToken = ctx.KW_TRUE();
		if (trueToken) {
			return parseBoolLiteral(trueToken, this.sourceName);
		}
		const falseToken = ctx.KW_FALSE();
		if (falseToken) {
			return parseBoolLiteral(falseToken, this.sourceName);
		}
		const identToken = ctx.IDENT();
		if (identToken) {
			if (ctx.LPAREN() && ctx.RPAREN()) {
				const argumentList = ctx.argumentList();
				return withLoc(
					{
						kind: "CallExpr",
						callee: withLoc(
							{ kind: "Identifier", text: identToken.getText() },
							identToken,
							this.sourceName,
						),
						args: argumentList ? this.buildArgumentList(argumentList) : [],
					},
					ctx,
					this.sourceName,
				);
			}
			if (ctx.LBRACK() && ctx.RBRACK()) {
				const indexCtx = ctx.expr();
				if (!indexCtx) {
					throw new Error("internal error: expected index expression");
				}
				const index = indexCtx.accept(this);
				if (!index || !isExpr(index)) {
					throw new Error("internal error: expected Expr");
				}
				return withLoc(
					{
						kind: "IndexExpr",
						array: withLoc(
							{ kind: "Identifier", text: identToken.getText() },
							identToken,
							this.sourceName,
						),
						index,
					},
					ctx,
					this.sourceName,
				);
			}
			return withLoc(
				{ kind: "Identifier", text: identToken.getText() },
				identToken,
				this.sourceName,
			);
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
		const scalarType = this.buildScalarType(ctx);
		const lengthToken = ctx.INT();
		if (!lengthToken) {
			return scalarType;
		}
		if (scalarType.kind === "StringType") {
			throw new CompileDiagnosticError("syntax", "array element type string is not supported", {
				location: contextLocation(ctx, this.sourceName),
			});
		}
		const rawLength = lengthToken.getText();
		const length = Number.parseInt(rawLength, 10);
		if (!Number.isInteger(length) || length <= 0) {
			throw new CompileDiagnosticError(
				"syntax",
				`array length must be a positive integer: ${rawLength}`,
				{
					location: tokenLocation(lengthToken.symbol, this.sourceName),
					nearText: rawLength,
				},
			);
		}
		return withLoc(
			{
				kind: "ArrayType",
				elementType: scalarType,
				length,
				rawLength,
			},
			ctx,
			this.sourceName,
		);
	};

	private buildAssignTarget(ctx: AssignTargetContext): AssignStmt["target"] {
		const identToken = ctx.IDENT();
		const name = identToken.getText();
		const indexCtx = ctx.expr();
		if (!indexCtx) {
			return withLoc({ kind: "Identifier", text: name }, identToken, this.sourceName);
		}
		const index = indexCtx.accept(this);
		if (!index || !isExpr(index)) {
			throw new Error("internal error: expected Expr");
		}
		return withLoc(
			{
				kind: "IndexExpr",
				array: withLoc({ kind: "Identifier", text: name }, identToken, this.sourceName),
				index,
			},
			ctx,
			this.sourceName,
		);
	}

	private buildScalarType(ctx: TypeNameContext): IntType | BoolType | StringType | CharType {
		const scalarTypeCtx = ctx.scalarType();
		if (!scalarTypeCtx) {
			throw new Error("internal error: expected scalarType");
		}
		if (scalarTypeCtx.KW_INT()) {
			return withLoc({ kind: "IntType" }, scalarTypeCtx, this.sourceName);
		}
		if (scalarTypeCtx.KW_BOOL()) {
			return withLoc({ kind: "BoolType" }, scalarTypeCtx, this.sourceName);
		}
		if (scalarTypeCtx.KW_STRING()) {
			return withLoc({ kind: "StringType" }, scalarTypeCtx, this.sourceName);
		}
		if (scalarTypeCtx.KW_CHAR()) {
			return withLoc({ kind: "CharType" }, scalarTypeCtx, this.sourceName);
		}
		throw new Error("internal error: invalid scalarType");
	}

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
		node.kind === "StringLiteral" ||
		node.kind === "CharLiteral" ||
		node.kind === "BoolLiteral" ||
		node.kind === "Identifier" ||
		node.kind === "BinaryExpr" ||
		node.kind === "CastExpr" ||
		node.kind === "CallExpr" ||
		node.kind === "IndexExpr"
	);
};

const isTypeNode = (node: AstResult): node is TypeNode => {
	return (
		node.kind === "IntType" ||
		node.kind === "BoolType" ||
		node.kind === "StringType" ||
		node.kind === "CharType" ||
		node.kind === "ArrayType"
	);
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

const tokenLocation = (token: antlr.Token, sourceName?: string): SourceLocation => {
	return {
		line: token.line,
		column: token.column,
		sourceName,
	};
};

const contextLocation = (ctx: antlr.ParserRuleContext, sourceName?: string): SourceLocation => {
	const start = ctx.start;
	return {
		line: start?.line ?? 1,
		column: start?.column ?? 0,
		sourceName,
	};
};

const withLoc = <T>(
	node: T,
	source: antlr.ParserRuleContext | antlr.Token | antlr.TerminalNode,
	sourceName?: string,
): T => {
	const base = node as object;
	if (source instanceof antlr.ParserRuleContext) {
		return { ...base, loc: contextLocation(source, sourceName) } as T;
	}
	if ("symbol" in source) {
		return { ...base, loc: tokenLocation(source.symbol, sourceName) } as T;
	}
	return { ...base, loc: tokenLocation(source, sourceName) } as T;
};

const parseIntLiteral = (token: antlr.TerminalNode, sourceName: string): IntLiteral => {
	const text = token.getText();
	const value = Number.parseInt(text, 10);
	if (!Number.isFinite(value)) {
		throw new CompileDiagnosticError("syntax", `invalid int literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	return withLoc({ kind: "IntLiteral", value, raw: text }, token, sourceName);
};

const parseBoolLiteral = (token: antlr.TerminalNode, sourceName: string): BoolLiteral => {
	const text = token.getText();
	if (text !== "true" && text !== "false") {
		throw new CompileDiagnosticError("syntax", `invalid bool literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	return withLoc({ kind: "BoolLiteral", value: text === "true", raw: text }, token, sourceName);
};

const parseStringLiteral = (token: antlr.TerminalNode, sourceName: string): StringLiteral => {
	const text = token.getText();
	if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"')) {
		throw new CompileDiagnosticError("syntax", `invalid string literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	const content = text.slice(1, -1);
	const bytes = decodeEscapedAscii(content, text, tokenLocation(token.symbol, sourceName));
	const value = String.fromCharCode(...bytes);
	return withLoc(
		{
			kind: "StringLiteral",
			value,
			bytes,
			raw: text,
		},
		token,
		sourceName,
	);
};

const parseCharLiteral = (token: antlr.TerminalNode, sourceName: string): CharLiteral => {
	const text = token.getText();
	if (text.length < 3 || !text.startsWith("'") || !text.endsWith("'")) {
		throw new CompileDiagnosticError("syntax", `invalid char literal: ${text}`, {
			location: tokenLocation(token.symbol, sourceName),
			nearText: text,
		});
	}
	const content = text.slice(1, -1);
	const bytes = decodeEscapedAscii(content, text, tokenLocation(token.symbol, sourceName));
	if (bytes.length !== 1) {
		throw new CompileDiagnosticError(
			"syntax",
			`char literal must contain exactly one byte: ${text}`,
			{
				location: tokenLocation(token.symbol, sourceName),
				nearText: text,
			},
		);
	}
	return withLoc(
		{
			kind: "CharLiteral",
			value: bytes[0]!,
			raw: text,
		},
		token,
		sourceName,
	);
};

const decodeEscapedAscii = (
	content: string,
	rawLiteral: string,
	location: SourceLocation,
): number[] => {
	const bytes: number[] = [];
	for (let i = 0; i < content.length; i++) {
		const ch = content[i]!;
		if (ch !== "\\") {
			const code = ch.charCodeAt(0);
			if (code > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`non-ascii character is not supported: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(code);
			continue;
		}

		i++;
		if (i >= content.length) {
			throw new CompileDiagnosticError("syntax", `incomplete escape sequence: ${rawLiteral}`, {
				location,
				nearText: rawLiteral,
			});
		}
		const esc = content[i]!;
		const simple = decodeSimpleEscape(esc);
		if (simple !== null) {
			bytes.push(simple);
			continue;
		}

		if (esc === "x") {
			const next = content.slice(i + 1, i + 3);
			if (!/^[0-9A-Fa-f]{2}$/.test(next)) {
				throw new CompileDiagnosticError("syntax", `invalid hex escape sequence: ${rawLiteral}`, {
					location,
					nearText: rawLiteral,
				});
			}
			const value = Number.parseInt(next, 16);
			if (value > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`hex escape is out of ascii range: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(value);
			i += 2;
			continue;
		}

		if (/[0-7]/.test(esc)) {
			let oct = esc;
			let j = i + 1;
			while (j < content.length && oct.length < 3 && /[0-7]/.test(content[j]!)) {
				oct += content[j]!;
				j++;
			}
			const value = Number.parseInt(oct, 8);
			if (value > 0x7f) {
				throw new CompileDiagnosticError(
					"syntax",
					`octal escape is out of ascii range: ${rawLiteral}`,
					{
						location,
						nearText: rawLiteral,
					},
				);
			}
			bytes.push(value);
			i = j - 1;
			continue;
		}

		throw new CompileDiagnosticError("syntax", `unsupported escape sequence: \\${esc}`, {
			location,
			nearText: rawLiteral,
		});
	}
	return bytes;
};

const decodeSimpleEscape = (esc: string): number | null => {
	switch (esc) {
		case "a":
			return 0x07;
		case "b":
			return 0x08;
		case "f":
			return 0x0c;
		case "n":
			return 0x0a;
		case "r":
			return 0x0d;
		case "t":
			return 0x09;
		case "v":
			return 0x0b;
		case "\\":
			return 0x5c;
		case "'":
			return 0x27;
		case '"':
			return 0x22;
		case "?":
			return 0x3f;
		default:
			return null;
	}
};

type BinaryOp = "+" | "-" | "*" | "/" | "==" | "!=" | "<" | "<=" | ">" | ">=";

const foldBinaryExprs = (
	parts: antlr.ParserRuleContext[],
	visitor: AstBuilder,
	validOps: BinaryOp[],
	ctx: antlr.ParserRuleContext,
	sourceName: string,
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
		acc = withLoc({ kind: "BinaryExpr", op: ops[i - 1]!, left: acc, right }, ctx, sourceName);
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
