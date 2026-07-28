/* ==================== Provider types ==================== */

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolDefinition {
  function: FunctionDefinition;
}

export interface ToolCall {
  name: string;
  args: string;
  id: string;
}

export interface ToolResult {
  name: string;
  result: string;
  id: string;
}

export interface ContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface Content {
  role: string;
  parts: ContentPart[];
}

/* ===================== Tool types ===================== */

export type ToolExecutor = (args: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

/* ================== Gemini-provider types ================== */

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { result: unknown } };
}

export interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}
