import { Request, Response, NextFunction } from "express";
import User from "../../../../models/User";

const updateName = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { name } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      name.trim().length < 5 ||
      name.trim().length > 50
    ) {
      res.status(400).json({ message: "Name must be 5-50 characters" });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() },
      { new: true },
    );

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        customInstructions: user.customInstructions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default updateName;
