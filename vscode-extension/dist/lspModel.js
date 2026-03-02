"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_PRIORITY = exports.TOKEN_TYPE_INDEX = exports.TOKEN_TYPES = void 0;
exports.TOKEN_TYPES = [
    "type",
    "parameter",
    "variable",
    "function",
    "keyword",
    "string",
    "number",
    "operator",
];
exports.TOKEN_TYPE_INDEX = {
    type: 0,
    parameter: 1,
    variable: 2,
    function: 3,
    keyword: 4,
    string: 5,
    number: 6,
    operator: 7,
};
exports.TOKEN_PRIORITY = {
    operator: 1,
    number: 2,
    string: 3,
    keyword: 4,
    type: 5,
    variable: 6,
    parameter: 7,
    function: 8,
};
//# sourceMappingURL=lspModel.js.map