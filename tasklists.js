"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasks = exports.tokenize = void 0;
const marked_1 = require("marked");
function tokenize(string) {
    return marked_1.lexer(string);
}
exports.tokenize = tokenize;
function tasks(tokens) {
    const tasks = [];
    marked_1.walkTokens(tokens, token => {
        if (token.type !== 'list_item') {
            return;
        }
        if (!token.task) {
            return;
        }
        const hack = token;
        tasks.push({ name: hack.tokens[0].text, completed: token.checked });
    });
    return tasks;
}
exports.tasks = tasks;
