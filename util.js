"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = void 0;
const process_1 = require("process");
function requireEnv(name) {
    const result = process_1.env[name];
    if (result === undefined) {
        throw new Error(`Expected environment "${name}" to be available`);
    }
    return result;
}
exports.requireEnv = requireEnv;
