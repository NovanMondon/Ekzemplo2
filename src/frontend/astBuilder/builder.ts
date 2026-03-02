import * as antlr from "antlr4ng";

import type {
	AssignStmt,
	Block,
	BoolType,
	BreakStmt,
	CharType,
	ContinueStmt,
	Expr,
	ExprStmt,
	ExternFunctionDecl,
	ForStmt,
	FunctionDecl,
	Identifier,
	IfStmt,
	IntType,
	ParamDecl,
	Program,
	ReturnStmt,
	Statement,
	StringType,
	TypeNode,
	VarDeclStmt,
	WhileStmt,
} from "../ast.js";
import { CompileDiagnosticError } from "../../diagnostics/compileDiagnostic.js";
import type {
	AdditiveExprContext,
	ArgumentListContext,
	AssignmentStatementContext,
	AssignTargetContext,
	BlockContext,
	BreakStatementContext,
	CastExprContext,
	ContinueStatementContext,
	EqualityExprContext,
	ExpressionStatementContext,
	ExprContext,
	ExternFunctionDeclarationContext,
	ExternParameterSpecContext,
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
} from "../generated/Ekzemplo2Parser.js";
import { Ekzemplo2ParserVisitor } from "../generated/Ekzemplo2ParserVisitor.js";
import { foldBinaryExprs } from "./fold.js";
import { contextLocation, tokenLocation, withLoc } from "./location.js";
import {
	parseBoolLiteral,
	parseCharLiteral,
	parseIntLiteral,
	parseStringLiteral,
} from "./literals.js";
import { type AstResult, expectExprResult, isStatement, isTypeNode } from "./types.js";

export class AstBuilder extends Ekzemplo2ParserVisitor<AstResult> {
	public constructor(private readonly sourceName: string) {
		super();
	}

	private expectKind<K extends AstResult["kind"]>(
		result: AstResult | null,
		kind: K,
	): Extract<AstResult, { kind: K }> {
		if (!result || result.kind !== kind) {
			throw new Error(`internal error: expected ${kind}`);
		}
		return result as Extract<AstResult, { kind: K }>;
	}

	private expectExpr(result: AstResult | null): Expr {
		return expectExprResult(result);
	}

	private expectStatement(result: AstResult | null): Statement {
		if (!result || !isStatement(result)) {
			throw new Error("internal error: expected Statement");
		}
		return result;
	}

	private expectType(result: AstResult | null): TypeNode {
		if (!result || !isTypeNode(result)) {
			throw new Error("internal error: expected type name");
		}
		return result;
	}

	private makeIdentifier(token: antlr.TerminalNode): Identifier {
		return withLoc<Identifier>(
			{ kind: "Identifier", text: token.getText() },
			token,
			this.sourceName,
		);
	}

	private makeVarDecl(
		type: TypeNode,
		nameToken: antlr.TerminalNode,
		ctx: antlr.ParserRuleContext,
		initializer?: Expr,
	): VarDeclStmt {
		return withLoc(
			{
				kind: "VarDeclStmt",
				name: this.makeIdentifier(nameToken),
				type,
				initializer,
			},
			ctx,
			this.sourceName,
		);
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
			return this.expectKind(externDecl.accept(this), "ExternFunctionDecl");
		}

		const fnDecl = ctx.functionDefinition();
		if (fnDecl) {
			return this.expectKind(fnDecl.accept(this), "FunctionDecl");
		}

		throw new Error("internal error: invalid top-level declaration");
	};

	public override visitExternFunctionDeclaration = (
		ctx: ExternFunctionDeclarationContext,
	): ExternFunctionDecl => {
		const returnType = this.expectType(ctx.typeName().accept(this));
		if (returnType.kind === "ArrayType") {
			throw new Error("array return type is not supported yet");
		}

		const params: ParamDecl[] = [];
		const externParameterSpec = ctx.externParameterSpec();
		const isVariadic = this.isExternVariadic(externParameterSpec);
		const parameterList = externParameterSpec?.parameterList();
		if (parameterList) {
			for (const paramCtx of parameterList.parameter()) {
				params.push(this.expectKind(paramCtx.accept(this), "ParamDecl"));
			}
		}

		return withLoc(
			{
				kind: "ExternFunctionDecl",
				name: this.makeIdentifier(ctx.IDENT()),
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
		const returnType = this.expectType(ctx.typeName().accept(this));
		if (returnType.kind === "ArrayType") {
			throw new Error("array return type is not supported yet");
		}
		const params: ParamDecl[] = [];
		const parameterList = ctx.parameterList();
		if (parameterList) {
			for (const paramCtx of parameterList.parameter()) {
				params.push(this.expectKind(paramCtx.accept(this), "ParamDecl"));
			}
		}
		const body = this.expectKind(ctx.block().accept(this), "Block");
		return withLoc(
			{
				kind: "FunctionDecl",
				name: this.makeIdentifier(ctx.IDENT()),
				returnType,
				params,
				body,
			},
			ctx,
			this.sourceName,
		);
	};

	public override visitParameter = (ctx: ParameterContext): ParamDecl => {
		const type = this.expectType(ctx.typeName().accept(this));
		if (type.kind === "ArrayType") {
			throw new Error("array parameter is not supported yet");
		}
		return withLoc(
			{
				kind: "ParamDecl",
				name: this.makeIdentifier(ctx.IDENT()),
				type,
			},
			ctx,
			this.sourceName,
		);
	};

	public override visitBlock = (ctx: BlockContext): Block => {
		const statements: Statement[] = [];
		for (const stmtCtx of ctx.statement()) {
			statements.push(this.expectStatement(stmtCtx.accept(this)));
		}
		return withLoc({ kind: "Block", statements }, ctx, this.sourceName);
	};

	public override visitStatement = (ctx: StatementContext): Statement => {
		const varDecl = ctx.variableDeclaration();
		if (varDecl) {
			return this.expectKind(varDecl.accept(this), "VarDeclStmt");
		}

		const assign = ctx.assignmentStatement();
		if (assign) {
			return this.expectKind(assign.accept(this), "AssignStmt");
		}

		const ret = ctx.returnStatement();
		if (ret) {
			return this.expectKind(ret.accept(this), "ReturnStmt");
		}

		const ifStmt = ctx.ifStatement();
		if (ifStmt) {
			return this.expectKind(ifStmt.accept(this), "IfStmt");
		}

		const whileStmt = ctx.whileStatement();
		if (whileStmt) {
			return this.expectKind(whileStmt.accept(this), "WhileStmt");
		}

		const forStmt = ctx.forStatement();
		if (forStmt) {
			return this.expectKind(forStmt.accept(this), "ForStmt");
		}

		const breakStmt = ctx.breakStatement();
		if (breakStmt) {
			return this.expectKind(breakStmt.accept(this), "BreakStmt");
		}

		const continueStmt = ctx.continueStatement();
		if (continueStmt) {
			return this.expectKind(continueStmt.accept(this), "ContinueStmt");
		}

		const exprStmt = ctx.expressionStatement();
		if (exprStmt) {
			return this.expectKind(exprStmt.accept(this), "ExprStmt");
		}

		const block = ctx.block();
		if (block) {
			return this.expectKind(block.accept(this), "Block");
		}

		throw new Error("internal error: invalid statement");
	};

	public override visitExpressionStatement = (ctx: ExpressionStatementContext): ExprStmt => {
		const value = this.expectExpr(ctx.expr().accept(this));
		return withLoc({ kind: "ExprStmt", value }, ctx, this.sourceName);
	};

	public override visitVariableDeclaration = (ctx: VariableDeclarationContext): VarDeclStmt => {
		const type = this.expectType(ctx.typeName().accept(this));
		const ident = ctx.IDENT();
		const initializerCtx = ctx.expr();
		if (initializerCtx) {
			const initializer = this.expectExpr(initializerCtx.accept(this));
			return this.makeVarDecl(type, ident, ctx, initializer);
		}
		return this.makeVarDecl(type, ident, ctx);
	};

	public override visitAssignmentStatement = (ctx: AssignmentStatementContext): AssignStmt => {
		const value = this.expectExpr(ctx.expr().accept(this));
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
		const value = this.expectExpr(ctx.expr().accept(this));
		return withLoc({ kind: "ReturnStmt", value }, ctx, this.sourceName);
	};

	public override visitIfStatement = (ctx: IfStatementContext): IfStmt => {
		const condition = this.expectExpr(ctx.expr().accept(this));
		const thenBranchCtx = ctx.statement(0);
		if (!thenBranchCtx) {
			throw new Error("internal error: expected then statement");
		}
		const thenBranch = this.expectStatement(thenBranchCtx.accept(this));

		const elseBranchCtx = ctx.statement(1);
		if (elseBranchCtx) {
			const elseBranch = this.expectStatement(elseBranchCtx.accept(this));
			return withLoc({ kind: "IfStmt", condition, thenBranch, elseBranch }, ctx, this.sourceName);
		}

		return withLoc({ kind: "IfStmt", condition, thenBranch }, ctx, this.sourceName);
	};

	public override visitForStatement = (ctx: ForStatementContext): ForStmt => {
		const init = this.buildForInit(ctx.forInit());
		const conditionCtx = ctx.expr();
		let condition: Expr | undefined;
		if (conditionCtx) {
			condition = this.expectExpr(conditionCtx.accept(this));
		}
		const update = this.buildForUpdate(ctx.forUpdate());

		const bodyCtx = ctx.statement();
		if (!bodyCtx) {
			throw new Error("internal error: expected statement");
		}
		const body = this.expectStatement(bodyCtx.accept(this));

		return withLoc({ kind: "ForStmt", init, condition, update, body }, ctx, this.sourceName);
	};

	public override visitWhileStatement = (ctx: WhileStatementContext): WhileStmt => {
		const condition = this.expectExpr(ctx.expr().accept(this));
		const bodyCtx = ctx.statement();
		if (!bodyCtx) {
			throw new Error("internal error: expected statement");
		}
		const body = this.expectStatement(bodyCtx.accept(this));
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
			const type = this.expectType(typeName.accept(this));
			const nameToken = ctx.IDENT();
			if (!nameToken) {
				throw new Error("internal error: expected identifier");
			}
			const initExprCtx = ctx.expr();
			if (initExprCtx) {
				const initializer = this.expectExpr(initExprCtx.accept(this));
				return this.makeVarDecl(type, nameToken, ctx, initializer);
			}
			return this.makeVarDecl(type, nameToken, ctx);
		}

		const targetCtx = ctx.assignTarget();
		if (targetCtx && ctx.ASSIGN()) {
			const value = ctx.expr();
			if (!value) {
				throw new Error("internal error: expected Expr");
			}
			const parsed = this.expectExpr(value.accept(this));
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
		const value = this.expectExpr(exprCtx.accept(this));
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
			const parsed = this.expectExpr(value.accept(this));
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
		const value = this.expectExpr(exprCtx.accept(this));
		return withLoc({ kind: "ExprStmt", value }, ctx, this.sourceName);
	}

	public override visitExpr = (ctx: ExprContext): Expr => {
		return this.expectExpr(ctx.equalityExpr().accept(this));
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
			const targetType = this.expectType(typeName.accept(this));
			const innerCtx = ctx.castExpr();
			if (!innerCtx) {
				throw new Error("internal error: expected castExpr");
			}
			const inner = this.expectExpr(innerCtx.accept(this));
			return withLoc({ kind: "CastExpr", targetType, value: inner }, ctx, this.sourceName);
		}
		const primaryCtx = ctx.primaryExpr();
		if (!primaryCtx) {
			throw new Error("internal error: expected primaryExpr");
		}
		return this.expectExpr(primaryCtx.accept(this));
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
						callee: this.makeIdentifier(identToken),
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
				const index = this.expectExpr(indexCtx.accept(this));
				return withLoc(
					{
						kind: "IndexExpr",
						array: this.makeIdentifier(identToken),
						index,
					},
					ctx,
					this.sourceName,
				);
			}
			return this.makeIdentifier(identToken);
		}
		const inner = ctx.expr();
		if (inner) {
			return this.expectExpr(inner.accept(this));
		}
		throw new Error("internal error: invalid primaryExpr");
	};

	private buildArgumentList(argumentList: ArgumentListContext): Expr[] {
		const args: Expr[] = [];
		for (const argCtx of argumentList.expr()) {
			args.push(this.expectExpr(argCtx.accept(this)));
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
		const indexCtx = ctx.expr();
		if (!indexCtx) {
			return this.makeIdentifier(identToken);
		}
		const index = this.expectExpr(indexCtx.accept(this));
		return withLoc(
			{
				kind: "IndexExpr",
				array: this.makeIdentifier(identToken),
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
		return false;
	}
}
