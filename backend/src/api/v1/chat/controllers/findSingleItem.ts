import { Request, Response, NextFunction } from "express";
import { findChatById } from "../../../../lib/chat";

const findSingleItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;

  try {
    const chat = await findChatById(id);

    const formattedMessages = chat.messages.map((msg) => ({
      id:
        (msg._id && typeof msg._id === "object" && msg._id.toString
          ? msg._id.toString()
          : (msg as any).id) || "",
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp ? Number(msg.timestamp) : Date.now(),
    }));

    const formatedChat = {
      id: chat.id,
      userId: chat.userId,
      name: chat.name,
      userName: chat.userName,
      messages: formattedMessages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };

    const response = {
      data: formatedChat,
      links: {
        self: `/chats/${chat.id}`,
        author: `/chats/${chat.userId}/author`,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export default findSingleItem;
