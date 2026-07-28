import Chat from "../../models/Chat";
import { notFound } from "../../utils/error";
import { User } from "./types";

const createChat = async (user: User) => {
  const chatData = {
    userId: user.id,
    name: "New Chat",
    userName: user.name,
    messages: [],
  };

  const newChat = new Chat(chatData);
  await newChat.save();

  return {
    id: newChat.id,
    ...newChat.toObject(),
  };
};

const findAll = async (userId: string) => {
  if (!userId) throw new Error("User id is required");

  return Chat.find({ userId }).sort({ createdAt: -1 });
};

const findChatById = async (id: string) => {
  if (!id) throw new Error("Id is required");

  const chat = await Chat.findById(id);
  if (!chat) {
    throw notFound();
  }

  return chat;
};

const updateMessageInChat = async (
  chatId: string,
  messageId: string,
  content: string,
) => {
  const chat = await Chat.findById(chatId);
  if (!chat) throw notFound();

  const msgIndex = chat.messages.findIndex(
    (msg) => msg._id?.toString() === messageId,
  );
  if (msgIndex === -1) throw notFound();

  chat.messages[msgIndex].content = content;
  chat.messages = chat.messages.slice(0, msgIndex + 1);
  chat.markModified("messages");
  await chat.save();

  return chat;
};

const removeChat = async (id: string) => {
  const chat = await Chat.findById(id);
  if (!chat) {
    throw notFound();
  }

  return Chat.findByIdAndDelete(id);
};

const removeAllChats = async (
  userId: string,
): Promise<{ deletedCount?: number }> => {
  if (!userId) throw new Error("User id is required");
  return Chat.deleteMany({ userId });
};

const updateChat = async (id: string, data: Record<string, unknown>) => {
  const chat = await Chat.findById(id);
  if (!chat) {
    throw notFound();
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  );
  return updatedChat;
};

export {
  createChat,
  findAll,
  findChatById,
  removeChat,
  removeAllChats,
  updateChat,
  updateMessageInChat,
};
