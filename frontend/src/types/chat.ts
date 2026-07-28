export interface FileData {
  mimeType: string;
  data?: string;
  name: string;
}

export interface Message {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  isTemp?: boolean;
  isTyping?: boolean;
  isStreaming?: boolean;
  chatName?: string;
  files?: { mimeType: string; name: string; data?: string }[];
}

export interface ChatData {
  id: string;
  name: string;
  messages: Message[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatState {
  chat: ChatResponse | null;
  allChats: ChatListResponse | null;
  currentChat: ChatResponse | null;
  isLoading: boolean;
  error: string | null;
  isGenerating: boolean;
  isDeleting: boolean;
  isCreating: boolean;
}

export interface ChatResponse {
  status: boolean;
  message: string;
  data: ChatData;
}

export interface ChatListResponse {
  status: boolean;
  message: string;
  data: ChatData[];
}

export interface CreateMessagePayload {
  prompt: string;
  chatId: string;
}


