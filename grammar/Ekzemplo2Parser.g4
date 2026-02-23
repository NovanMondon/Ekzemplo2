parser grammar Ekzemplo2Parser;

options {
  tokenVocab = Ekzemplo2Lexer;
}

program
  : functionDefinition EOF
  ;

functionDefinition
  : KW_INT IDENT LPAREN RPAREN block
  ;

block
  : LBRACE returnStatement RBRACE
  ;

returnStatement
  : KW_RETURN INT SEMI
  ;
