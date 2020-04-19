"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const marked_1 = require("marked");
function tokenize(string) {
    return marked_1.lexer(string);
}
exports.tokenize = tokenize;
function* tasks(tokens) {
    for (let i = 0; i < tokens.length - 2; ++i) {
        const token = tokens[i];
        if (token.type !== 'list_item_start') {
            continue;
        }
        if (!token.task) {
            continue;
        }
        const nextToken = tokens[i + 1];
        if (nextToken.type !== 'text') {
            continue;
        }
        yield { name: nextToken.text, completed: token.checked };
    }
}
exports.tasks = tasks;
