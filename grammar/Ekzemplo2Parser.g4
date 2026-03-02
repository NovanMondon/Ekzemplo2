parser grammar Ekzemplo2Parser;

options {
  tokenVocab = Ekzemplo2Lexer;
}

program
  : topLevelDeclaration+ EOF
  ;

topLevelDeclaration
  : functionDefinition
  | externFunctionDeclaration
  ;

functionDefinition
  : typeName IDENT LPAREN parameterList? RPAREN block
  ;

externFunctionDeclaration
  : typeName IDENT LPAREN externParameterSpec? RPAREN SEMI
  ;

externParameterSpec
  : parameterList (COMMA ELLIPSIS)?
  | ELLIPSIS
  ;

parameterList
  : parameter (COMMA parameter)*
  ;

parameter
  : typeName IDENT
  ;

typeName
  : scalarType (LBRACK INT RBRACK)?
  ;

scalarType
  : KW_INT
  | KW_BOOL
  | KW_STRING
  | KW_CHAR
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
  | assignTarget ASSIGN expr
  | expr
  ;

forUpdate
  : assignTarget ASSIGN expr
  | expr
  ;

assignTarget
  : IDENT
  | IDENT LBRACK expr RBRACK
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
  : assignTarget ASSIGN expr SEMI
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
  | STRING_LITERAL
  | CHAR_LITERAL
  | KW_TRUE
  | KW_FALSE
  | IDENT LPAREN argumentList? RPAREN
  | IDENT LBRACK expr RBRACK
  | IDENT
  | LPAREN expr RPAREN
  ;

argumentList
  : expr (COMMA expr)*
  ;
