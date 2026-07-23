import { Schema, model, Document } from "mongoose";
import { MessageDocument } from "../types/chat";

export interface ChatDocument extends Document {
  userId: string;
  userName: string;
  name: string;
  messages: MessageDocument[];
  summary?: string;
  summaryUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const chatSchema = new Schema<ChatDocument>(
  {
    userId: { type: String, ref: "User", required: true },
    userName: { type: String, required: true },
    name: { type: String, default: "New Chat" },
    messages: [
      {
        role: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: Number, required: true },
      },
    ],
    summary: { type: String },
    summaryUpdatedAt: { type: Date },
  },
  { timestamps: true },
);

const Chat = model<ChatDocument>("Chat", chatSchema);

export default Chat;
