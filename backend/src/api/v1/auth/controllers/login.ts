import { Request, Response, NextFunction } from "express";
import * as authService from "../../../../lib/auth";
import { loginSchema } from "../../../../validators/auth";

const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.errors.map((e) => e.message),
    });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const { accessToken, refreshToken } = await authService.login({
      email,
      password,
    });

    const response = {
      code: 200,
      message: "Login Successfull",
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      links: {
        self: "/auth/login",
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export default login;
