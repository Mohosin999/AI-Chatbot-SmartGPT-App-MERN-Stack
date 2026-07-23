import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import * as userService from "../lib/user";
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

    const user = await userService.findUserByRefreshToken(refresh_token);

    if (!user) {
      res.status(200).json({
        message: "Invalid session. Logging out...",
        logout: true,
      });
      return;
    }

    if (
      "refreshTokenExpiresAt" in user &&
      user.refreshTokenExpiresAt &&
      new Date(user.refreshTokenExpiresAt) < new Date()
    ) {
      await User.findByIdAndUpdate(user.id, {
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });

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
