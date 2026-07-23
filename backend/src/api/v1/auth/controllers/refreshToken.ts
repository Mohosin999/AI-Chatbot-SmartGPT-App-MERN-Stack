import { Request, Response, NextFunction } from "express";
import * as tokenService from "../../../../lib/token";
import User from "../../../../models/User";

const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const payload = {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
    };

    const newAccessToken = tokenService.generateAccessToken({ payload });
    const { refreshToken, expiresAt } = tokenService.generateRefreshToken();

    await User.findByIdAndUpdate(req.user!.id, {
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    });

    const response = {
      code: 200,
      message: "Access token with refresh token successfully generated",
      data: {
        access_token: newAccessToken,
        refresh_token: refreshToken,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export default refreshToken;
