"use strict";
// Use ES6 supported by Node v6.10 only!
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
exports.default = {
    tmp: path_1.default.join('/tmp', 'tmp-build'),
};
//# sourceMappingURL=config.js.map