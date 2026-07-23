import { Request, Response, NextFunction } from "express";
import * as tokenService from "../lib/token";
import * as userService from "../lib/user";
import { authenticationError } from "../utils/error";

const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(authenticationError());
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = tokenService.verifyAccessToken({ token }) as Record<string, unknown>;
    const user = await userService.findUserByEmail(decoded.email as string);

    if (!user) {
      return next(authenticationError());
    }

    const userObj = user.toObject ? user.toObject() : user;
    req.user = { ...userObj, id: user.id };
    next();
  } catch (error) {
    console.log(error);
    next(authenticationError());
  }
};

export default authenticate;
