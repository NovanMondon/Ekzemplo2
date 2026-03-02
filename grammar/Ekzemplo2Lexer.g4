lexer grammar Ekzemplo2Lexer;

WS: [ \t\r\n]+ -> skip;

LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;

KW_INT: 'int';
KW_BOOL: 'bool';
KW_IF: 'if';
KW_ELSE: 'else';
KW_FOR: 'for';
KW_WHILE: 'while';
KW_BREAK: 'break';
KW_CONTINUE: 'continue';
KW_RETURN: 'return';
KW_TRUE: 'true';
KW_FALSE: 'false';

PLUS: '+';
MINUS: '-';
STAR: '*';
SLASH: '/';

EQ: '==';
NEQ: '!=';
ASSIGN: '=';
LTE: '<=';
GTE: '>=';
LT: '<';
GT: '>';

LPAREN: '(';
RPAREN: ')';
LBRACK: '[';
RBRACK: ']';
COMMA: ',';
LBRACE: '{';
RBRACE: '}';
SEMI: ';';

IDENT: [a-zA-Z_] [a-zA-Z0-9_]*;
INT: [0-9]+;

ERROR_CHAR: .;
