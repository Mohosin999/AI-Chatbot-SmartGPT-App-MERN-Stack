import rateLimit from "express-rate-limit";
import RedisStore, { type RedisReply } from "rate-limit-redis";
import { getRedisClient } from "../redis";

const sendCommand = (...args: string[]) => {
  const client = getRedisClient();
  const [command, ...rest] = args;
  return client.call(command, ...rest) as Promise<RedisReply>;
};

export const generalLimiter = rateLimit({
  store: new RedisStore({ sendCommand, prefix: "rl:general:" }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later.",
    status: 429,
  },
});

export const authLimiter = rateLimit({
  store: new RedisStore({ sendCommand, prefix: "rl:auth:" }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many auth attempts, please try again later.",
    status: 429,
  },
});

export const aiLimiter = rateLimit({
  store: new RedisStore({ sendCommand, prefix: "rl:ai:" }),
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many AI requests, please slow down.",
    status: 429,
  },
});
