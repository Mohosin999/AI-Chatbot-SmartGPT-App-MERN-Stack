import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { getRedisClient } from "../redis";
import { authenticationError } from "../utils/error";

const authenticateRefresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(200).json({
        message: "Session expired. Logging out...",
        logout: true,
      });
      return;
    }

    const redis = getRedisClient();
    const userId = await redis.get(`refresh_token:${refresh_token}`);

    if (!userId) {
      // Token missing or expired (Redis auto-deleted it via TTL)
      res.status(200).json({
        message: "Session expired. Logging out...",
        logout: true,
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      await redis.del(`refresh_token:${refresh_token}`);

      res.status(200).json({
        message: "Session expired. Logging out...",
        logout: true,
      });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    console.log(error);
    next(authenticationError());
  }
};

export default authenticateRefresh;
