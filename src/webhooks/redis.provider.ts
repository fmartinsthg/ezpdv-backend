import IORedis, { RedisOptions } from "ioredis";

export const BULLMQ_REDIS = "BULLMQ_REDIS_CONNECTION";

export function createBullMqRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const opts: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (url.startsWith("rediss://")) {
    (opts as any).tls = {};
  }

  return new IORedis(url, opts);
}
