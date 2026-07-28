import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { getRedisClient } from "../../redis";
import { serverError } from "../../utils/error";
import {
  DecodedTokenParams,
  GenerateAccessTokenParams,
  VerifyAccessTokenParams,
} from "./types";

const REFRESH_TOKEN_TTL_SECONDS = 3 * 60; // 3 minutes

const generateAccessToken = ({
  payload,
  algorithm = "HS256",
  secret = process.env.ACCESS_TOKEN_SECRET,
  expiresIn = "1m",
}: GenerateAccessTokenParams): string => {
  try {
    return jwt.sign(
      payload,
      secret as string,
      { expiresIn, algorithm } as jwt.SignOptions,
    );
  } catch (error) {
    console.log("[JWT]", error);
    throw serverError();
  }
};

const generateRefreshToken = async (
  userId: string,
): Promise<{
  refreshToken: string;
  expiresAt: Date;
}> => {
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  const redis = getRedisClient();
  await redis.set(
    `refresh_token:${refreshToken}`,
    userId,
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );

  return { refreshToken, expiresAt };
};

const verifyAccessToken = ({
  token,
  algorithm = "HS256",
  secret = process.env.ACCESS_TOKEN_SECRET,
}: VerifyAccessTokenParams): jwt.JwtPayload => {
  try {
    const decoded = jwt.verify(token, secret as string, {
      algorithms: [algorithm] as jwt.Algorithm[],
    });

    return decoded as jwt.JwtPayload;
  } catch (error) {
    console.log("[JWT]", error);
    throw serverError();
  }
};

const decodedToken = ({ token }: DecodedTokenParams): jwt.JwtPayload | null => {
  try {
    return jwt.decode(token, { json: true }) as jwt.JwtPayload | null;
  } catch (error) {
    console.log("[JWT]", error);
    throw serverError();
  }
};

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  decodedToken,
};
