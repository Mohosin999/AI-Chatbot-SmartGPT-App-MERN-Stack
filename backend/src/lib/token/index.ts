import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { serverError } from "../../utils/error";

interface GenerateAccessTokenParams {
  payload: Record<string, unknown>;
  algorithm?: string;
  secret?: string;
  expiresIn?: string;
}

interface VerifyAccessTokenParams {
  token: string;
  algorithm?: string;
  secret?: string;
}

interface DecodedTokenParams {
  token: string;
  algorithm?: string;
}

const generateAccessToken = ({
  payload,
  algorithm = "HS256",
  secret = process.env.ACCESS_TOKEN_SECRET,
  expiresIn = "1d",
}: GenerateAccessTokenParams): string => {
  try {
    return jwt.sign(payload, secret as string, { expiresIn, algorithm } as jwt.SignOptions);
  } catch (error) {
    console.log("[JWT]", error);
    throw serverError();
  }
};

const generateRefreshToken = (): {
  refreshToken: string;
  expiresAt: Date;
} => {
  const refreshToken = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
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

const decodedToken = ({
  token,
}: DecodedTokenParams): jwt.JwtPayload | null => {
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
