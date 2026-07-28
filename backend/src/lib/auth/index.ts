import { OAuth2Client } from "google-auth-library";
import { userExist, createUser, findUserByEmail } from "../user";
import { badRequest } from "../../utils/error";
import { generateHash, hashMatched } from "../../utils/hashing";
import { generateAccessToken, generateRefreshToken } from "../token";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------

const register = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) => {
  const hasUser = await userExist(email);
  if (hasUser) {
    throw badRequest("User already exist");
  }

  const hashedPassword = await generateHash(password);
  const user = await createUser({ name, email, password: hashedPassword });

  return user;
};

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------

const login = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const user = await findUserByEmail(email);
  if (!user) {
    throw badRequest("Invalid Credentials");
  }

  if (!user.password) {
    throw badRequest("Invalid Credentials");
  }

  const matched = await hashMatched(password, user.password);
  if (!matched) {
    throw badRequest("Invalid Credentials");
  }

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user as any).role,
  };

  const accessToken = generateAccessToken({ payload });
  const { refreshToken } = await generateRefreshToken(user.id);

  return { accessToken, refreshToken };
};

// ---------------------------------------------------------------------
// Google Login
// ---------------------------------------------------------------------

const googleLogin = async ({ credential }: { credential: string }) => {
  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw badRequest("Invalid Google credential");
  }

  if (!payload || !payload.email) {
    throw badRequest("Invalid Google credential");
  }

  const email = payload.email;
  const name = payload.name || email.split("@")[0];

  let user = await findUserByEmail(email);

  if (!user) {
    user = await createUser({ name, email, password: null });
  }

  const tokenPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
  };

  const ourAccessToken = generateAccessToken({ payload: tokenPayload });
  const { refreshToken } = await generateRefreshToken(user.id);

  return { accessToken: ourAccessToken, refreshToken };
};

export { register, login, googleLogin };
