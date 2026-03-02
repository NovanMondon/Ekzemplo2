lexer grammar Ekzemplo2Lexer;

WS: [ \t\r\n]+ -> skip;

LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;

KW_INT: 'int';
KW_BOOL: 'bool';
KW_RETURN: 'return';
KW_TRUE: 'true';
KW_FALSE: 'false';

PLUS: '+';
MINUS: '-';
STAR: '*';
SLASH: '/';

EQ: '==';
NEQ: '!=';
LTE: '<=';
GTE: '>=';
LT: '<';
GT: '>';

LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
SEMI: ';';

IDENT: [a-zA-Z_] [a-zA-Z0-9_]*;
INT: [0-9]+;

ERROR_CHAR: .;
