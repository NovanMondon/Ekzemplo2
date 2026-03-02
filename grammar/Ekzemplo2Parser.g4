parser grammar Ekzemplo2Parser;

options {
  tokenVocab = Ekzemplo2Lexer;
}

program
  : functionDefinition+ EOF
  ;

functionDefinition
  : typeName IDENT LPAREN RPAREN block
  ;

typeName
  : KW_INT
  | KW_BOOL
  ;

block
  : LBRACE returnStatement RBRACE
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
  | IDENT
  | LPAREN expr RPAREN
  ;
