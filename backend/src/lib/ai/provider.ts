import { GenerationConfig } from "../../types/common";
import { Content, ToolCall, ToolDefinition, ToolResult } from "./types";

const QUOTA_ERROR_PATTERNS = [
  "429",
  "quota",
  "Quota",
  "insufficient_quota",
  "quota_exceeded",
  "rate_limit",
] as const;

// Allows custom handling of AI function calls
export type FunctionCallHandler = (call: ToolCall) => Promise<ToolResult>;

export interface GenerateContentOptions {
  config?: GenerationConfig;
  tools?: ToolDefinition[];
  onFunctionCall?: FunctionCallHandler;
}

/**
 * Common interface for all AI providers.
 * Lets callers switch providers without changing their code.
 */
export interface AIProvider {
  readonly name: string;

  generateContentStream(
    contents: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[],
    signal?: AbortSignal,
    options?: GenerateContentOptions,
  ): AsyncGenerator<string>;

  generateContent(
    contents: { role: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[],
    options?: GenerateContentOptions,
  ): Promise<string>;

  generateContentText(prompt: string): Promise<string>;
}

export function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return QUOTA_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
