import { Request, Response, NextFunction } from "express";
import User from "../../../../models/User";

const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        code: 401,
        message: "User not found",
      });
      return;
    }

    await User.findByIdAndUpdate(userId, {
      refreshToken: null,
      refreshTokenExpiresAt: null,
    });

    res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default logout;
