"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BULLMQ_REDIS = void 0;
exports.createBullMqRedis = createBullMqRedis;
const ioredis_1 = __importDefault(require("ioredis"));
exports.BULLMQ_REDIS = "BULLMQ_REDIS_CONNECTION";
function createBullMqRedis() {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    const opts = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
    if (url.startsWith("rediss://")) {
        opts.tls = {};
    }
    return new ioredis_1.default(url, opts);
}
