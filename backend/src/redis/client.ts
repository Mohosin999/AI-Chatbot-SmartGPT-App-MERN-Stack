import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      redis = new Redis({
        host: process.env.REDIS_HOST || "redis",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || "defaultpassword",
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });
    }

    redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redis.on("connect", () => {
      console.log("Connected to Redis");
    });
  }

  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  await client.ping();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
