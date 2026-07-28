import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../../../../redis";

const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { refresh_token } = req.body;

    if (!userId) {
      res.status(401).json({
        code: 401,
        message: "User not found",
      });
      return;
    }

    if (refresh_token) {
      const redis = getRedisClient();
      await redis.del(`refresh_token:${refresh_token}`);
    }

    res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default logout;
