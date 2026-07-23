import { Request, Response, NextFunction } from "express";
import User from "../../../../models/User";
import { tokenCounter } from "../../../../lib/memory/TokenCounter";

const SYSTEM_PROMPT_MAX_TOKENS = 6_400;

const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { customInstructions } = req.body;

    if (typeof customInstructions === "string") {
      const tokens = tokenCounter.count(customInstructions);
      if (tokens > SYSTEM_PROMPT_MAX_TOKENS) {
        res.status(400).json({
          message: `Custom instructions exceed the ${SYSTEM_PROMPT_MAX_TOKENS.toLocaleString()} token limit (used ${tokens} tokens).`,
        });
        return;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { customInstructions },
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

export default updateMe;
