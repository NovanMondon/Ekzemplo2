lexer grammar Ekzemplo2Lexer;

WS: [ \t\r\n]+ -> skip;

LINE_COMMENT: '//' ~[\r\n]* -> skip;
BLOCK_COMMENT: '/*' .*? '*/' -> skip;

IDENT: [a-zA-Z_] [a-zA-Z0-9_]*;
INT: [0-9]+;

ERROR_CHAR: .;
