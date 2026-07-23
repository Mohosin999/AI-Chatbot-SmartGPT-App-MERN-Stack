export interface Message {
  _id?: { toString(): string } | string;
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isImage?: boolean;
  isPublished?: boolean;
  chatName?: string;
}

export interface MessageDocument {
  _id?: { toString(): string } | string;
  id?: string;
  role: string;
  content: string;
  timestamp: number;
  isImage?: boolean;
  isPublished?: boolean;
}

export interface Chat {
  _id: string;
  id: string;
  userId: string;
  userName: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatDoc {
  _doc: Chat;
  id: string;
  userId: string;
  userName: string;
  name: string;
  messages: Message[];
}

export interface ChatObj {
  id: string;
  userId: string;
  name: string;
  userName: string;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}
