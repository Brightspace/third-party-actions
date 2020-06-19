"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = void 0;
function requireEnv(name) {
    const result = process.env[name];
    if (result === undefined) {
        throw new Error(`Expected environment "${name}" to be available`);
    }
    return result;
}
exports.requireEnv = requireEnv;
