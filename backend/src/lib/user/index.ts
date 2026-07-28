import User from "../../models/User";
import { badRequest } from "../../utils/error";

const findUserByEmail = async (email: string) => {
  const user = await User.findOne({ email });
  return user ?? null;
};

const userExist = async (email: string): Promise<boolean> => {
  const user = await findUserByEmail(email);
  return user !== null;
};

const createUser = async ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password?: string | null;
}) => {
  if (!name || !email) throw badRequest("Invalid Parameters");

  const user = new User({ name, email, password });
  await user.save();
  return user;
};

export { findUserByEmail, userExist, createUser };
