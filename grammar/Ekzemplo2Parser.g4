parser grammar Ekzemplo2Parser;

options {
  tokenVocab = Ekzemplo2Lexer;
}

program
  : functionDefinition+ EOF
  ;

functionDefinition
  : typeName IDENT LPAREN parameterList? RPAREN block
  ;

parameterList
  : parameter (COMMA parameter)*
  ;

parameter
  : typeName IDENT
  ;

typeName
  : KW_INT
  | KW_BOOL
  ;

block
  : LBRACE statement* RBRACE
  ;

statement
  : variableDeclaration
  | assignmentStatement
  | ifStatement
  | forStatement
  | whileStatement
  | breakStatement
  | continueStatement
  | returnStatement
  | expressionStatement
  | block
  ;

ifStatement
  : KW_IF LPAREN expr RPAREN statement (KW_ELSE statement)?
  ;

forStatement
  : KW_FOR LPAREN forInit? SEMI expr? SEMI forUpdate? RPAREN statement
  ;

forInit
  : typeName IDENT (ASSIGN expr)?
  | IDENT ASSIGN expr
  | expr
  ;

forUpdate
  : IDENT ASSIGN expr
  | expr
  ;

whileStatement
  : KW_WHILE LPAREN expr RPAREN statement
  ;

breakStatement
  : KW_BREAK SEMI
  ;

continueStatement
  : KW_CONTINUE SEMI
  ;

expressionStatement
  : expr SEMI
  ;

variableDeclaration
  : typeName IDENT (ASSIGN expr)? SEMI
  ;

assignmentStatement
  : IDENT ASSIGN expr SEMI
  ;

returnStatement
  : KW_RETURN expr SEMI
  ;

expr
  : equalityExpr
  ;

equalityExpr
  : relationalExpr ((EQ | NEQ) relationalExpr)*
  ;

relationalExpr
  : additiveExpr ((LT | LTE | GT | GTE) additiveExpr)*
  ;

additiveExpr
  : multiplicativeExpr ((PLUS | MINUS) multiplicativeExpr)*
  ;

multiplicativeExpr
  : castExpr ((STAR | SLASH) castExpr)*
  ;

castExpr
  : LPAREN typeName RPAREN castExpr
  | primaryExpr
  ;

primaryExpr
  : INT
  | KW_TRUE
  | KW_FALSE
  | IDENT LPAREN argumentList? RPAREN
  | IDENT
  | LPAREN expr RPAREN
  ;

argumentList
  : expr (COMMA expr)*
  ;
