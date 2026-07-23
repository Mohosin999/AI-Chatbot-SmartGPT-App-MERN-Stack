import { Request, Response, NextFunction } from "express";
import User from "../../../../models/User";
import Chat from "../../../../models/Chat";

const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await Chat.deleteMany({ user: userId });

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export default deleteAccount;
