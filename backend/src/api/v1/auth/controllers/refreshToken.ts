import { Request, Response, NextFunction } from "express";
import * as tokenService from "../../../../lib/token";

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

    const { refresh_token } = req.body;
    const newAccessToken = tokenService.generateAccessToken({ payload });

    const response = {
      code: 200,
      message: "Access token successfully refreshed",
      data: {
        access_token: newAccessToken,
        refresh_token: refresh_token,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export default refreshToken;
