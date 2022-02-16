"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vm2_1 = require("vm2");
const performance_now_1 = __importDefault(require("performance-now"));
const stats_lite_1 = __importDefault(require("stats-lite"));
const debug = require('debug')('bp:worker');
function getParseTime(currentScript, trialCount = 5) {
    let baseVMScript, currentVMScript;
    let baseCounter = 0;
    let baseResults = [];
    let currentCounter = 0;
    let currentResults = [];
    const baseScript = fs_1.default.readFileSync(path_1.default.join(__dirname, 'fixed', 'parseReference.js'), 'utf8');
    try {
        while (baseCounter++ < trialCount) {
            baseVMScript = new vm2_1.VMScript(`${Math.random()}; ${baseScript}`);
            const start = (0, performance_now_1.default)();
            baseVMScript.compile();
            const end = (0, performance_now_1.default)();
            baseResults.push(end - start);
        }
        while (currentCounter++ < trialCount) {
            currentVMScript = new vm2_1.VMScript(`${Math.random()}; ${currentScript}`);
            const start = (0, performance_now_1.default)();
            currentVMScript.compile();
            const end = (0, performance_now_1.default)();
            currentResults.push(end - start);
        }
        const baseMedian = stats_lite_1.default.median(baseResults);
        const currentMedian = stats_lite_1.default.median(currentResults);
        debug('base parse time: %d | script parse time: %d', baseMedian, currentMedian);
        debug('base deviation: %d | script deviation: %d', stats_lite_1.default.stdev(baseResults), stats_lite_1.default.stdev(currentResults));
        debug('parse time ratio', currentMedian / baseMedian);
        return {
            baseParseTime: baseMedian,
            scriptParseTime: currentMedian,
        };
    }
    catch (err) {
        console.error('Failed to get parsed times, is this a valid JS file?');
        return {};
    }
}
exports.default = getParseTime;
