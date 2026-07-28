import { Request, Response, NextFunction } from "express";
import * as authService from "../../../../lib/auth";
import { generateAccessToken, generateRefreshToken } from "../../../../lib/token";
import { registerSchema } from "../../../../validators/auth";

const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.errors.map((e) => e.message),
    });
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const user = await authService.register({ name, email, password });

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const accessToken = generateAccessToken({ payload });
    const { refreshToken } = await generateRefreshToken(user.id);

    const response = {
      code: 201,
      message: "User Created Successfully",
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      links: {
        self: "/auth/register",
        login: "/auth/login",
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export default register;
