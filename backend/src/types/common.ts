export interface AppError extends Error {
  status?: number;
  errors?: string[];
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string; // "application/json" for JSON mode
  responseSchema?: Record<string, unknown>;
}

export interface MessageDocument {
  _id?: { toString(): string } | string;
  id?: string;
  role: string;
  content: string;
  timestamp: number;
}
