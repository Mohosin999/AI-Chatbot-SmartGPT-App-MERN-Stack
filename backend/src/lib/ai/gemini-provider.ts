import genAI from "../../config/gemini";
import type {
  Content,
  GenerateContentRequest,
  Tool,
} from "@google/generative-ai";
import type { AIProvider, FunctionCallHandler } from "./provider";
import {
  GeminiContent,
  GeminiPart,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./types";
import { GenerationConfig } from "../../types/common";

const mapRole = (role: string): string => {
  if (role === "assistant") return "model";
  if (role === "system") return "user";
  return role;
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  private getModel(config?: GenerationConfig) {
    const hasConfig = config && Object.keys(config).length > 0;
    return genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      ...(hasConfig ? { generationConfig: this.mapConfig(config!) } : {}),
    });
  }

  private mapConfig(config: GenerationConfig): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (config.temperature !== undefined)
      mapped.temperature = config.temperature;
    if (config.topP !== undefined) mapped.topP = config.topP;
    if (config.topK !== undefined) mapped.topK = config.topK;
    if (config.maxOutputTokens !== undefined)
      mapped.maxOutputTokens = config.maxOutputTokens;
    if (config.responseMimeType)
      mapped.responseMimeType = config.responseMimeType;
    if (config.responseSchema) mapped.responseSchema = config.responseSchema;
    return mapped;
  }

  private mapTools(tools: ToolDefinition[]) {
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  private mapContents(contents: GeminiContent[]) {
    return contents.map((c) => ({
      role: mapRole(c.role),
      parts: c.parts.map((p) => {
        if (p.functionCall) return { functionCall: p.functionCall };
        if (p.functionResponse) return { functionResponse: p.functionResponse };
        return { text: p.text || "" };
      }),
    }));
  }

  // ---------------------------------------------------------------------
  // Streaming
  // ---------------------------------------------------------------------

  private async *_streamWithTools(
    contents: GeminiContent[],
    signal: AbortSignal | undefined,
    tools: ToolDefinition[] | undefined,
    onFunctionCall: FunctionCallHandler | undefined,
    config: GenerationConfig | undefined,
    depth: number = 0,
  ): AsyncGenerator<string> {
    // Safety: max 5 rounds of tool calls
    if (depth > 5) {
      yield "I've used too many tools to answer this. Please try a simpler request.";
      return;
    }

    const model = this.getModel(config);
    const request: GenerateContentRequest = {
      contents: this.mapContents(contents) as Content[],
    };
    if (tools && tools.length > 0) {
      request.tools = this.mapTools(tools) as Tool[];
    }

    const result = await model.generateContentStream(request);

    // --- Stream all text chunks from this round ---
    for await (const chunk of result.stream) {
      if (signal?.aborted) break;
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }

    if (signal?.aborted) return;

    // If model requests function calls, execute them, append results to conversation, and recurse (max depth 5)
    const response = await result.response;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0 && onFunctionCall) {
      const toolResults: ToolResult[] = [];
      for (const fc of functionCalls) {
        const toolCall: ToolCall = {
          name: fc.name,
          args: JSON.stringify(fc.args ?? {}),
          id: fc.name,
        };
        const result = await onFunctionCall(toolCall);
        toolResults.push(result);
      }

      const functionCallParts = functionCalls.map((fc) => ({
        functionCall: { name: fc.name, args: fc.args ?? {} },
      }));

      const functionResponseParts = toolResults.map((tr) => ({
        functionResponse: { name: tr.name, response: { result: tr.result } },
      }));

      const updatedContents: GeminiContent[] = [
        ...contents,
        { role: "model", parts: functionCallParts as GeminiPart[] },
        { role: "user", parts: functionResponseParts as GeminiPart[] },
      ];

      // Recurse with tool results appended — AI needs updated context for its final reply
      for await (const chunk of this._streamWithTools(
        updatedContents,
        signal,
        tools,
        onFunctionCall,
        config,
        depth + 1,
      )) {
        yield chunk;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Non-streaming
  // ---------------------------------------------------------------------

  private async _contentWithTools(
    contents: GeminiContent[],
    tools: ToolDefinition[] | undefined,
    onFunctionCall: FunctionCallHandler | undefined,
    config: GenerationConfig | undefined,
    depth: number = 0,
  ): Promise<string> {
    if (depth > 5) {
      return "I've used too many tools to answer this. Please try a simpler request.";
    }

    const model = this.getModel(config);
    const request: GenerateContentRequest = {
      contents: this.mapContents(contents) as Content[],
    };
    if (tools?.length) {
      request.tools = this.mapTools(tools) as Tool[];
    }

    const result = await model.generateContent(request);
    const response = result.response;

    const functionCalls = response.functionCalls();

    if (functionCalls?.length && onFunctionCall) {
      const toolResults: ToolResult[] = [];
      for (const fc of functionCalls) {
        const toolCall: ToolCall = {
          name: fc.name,
          args: JSON.stringify(fc.args ?? {}),
          id: fc.name,
        };
        const result = await onFunctionCall(toolCall);
        toolResults.push(result);
      }

      const updatedContents: GeminiContent[] = [
        ...contents,
        {
          role: "model",
          parts: functionCalls.map((fc) => ({
            functionCall: { name: fc.name, args: fc.args ?? {} },
          })) as GeminiPart[],
        },
        {
          role: "user",
          parts: toolResults.map((tr) => ({
            functionResponse: {
              name: tr.name,
              response: { result: tr.result },
            },
          })) as GeminiPart[],
        },
      ];

      return this._contentWithTools(
        updatedContents,
        tools,
        onFunctionCall,
        config,
        depth + 1,
      );
    }

    return response.text().trim();
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  async *generateContentStream(
    contents: { role: string; parts: { text: string }[] }[],
    signal?: AbortSignal,
    options?: {
      config?: GenerationConfig;
      tools?: ToolDefinition[];
      onFunctionCall?: FunctionCallHandler;
    },
  ): AsyncGenerator<string> {
    yield* this._streamWithTools(
      contents,
      signal,
      options?.tools,
      options?.onFunctionCall,
      options?.config,
    );
  }

  async generateContent(
    contents: { role: string; parts: { text: string }[] }[],
    options?: {
      config?: GenerationConfig;
      tools?: ToolDefinition[];
      onFunctionCall?: FunctionCallHandler;
    },
  ): Promise<string> {
    return this._contentWithTools(
      contents,
      options?.tools,
      options?.onFunctionCall,
      options?.config,
    );
  }

  async generateContentText(prompt: string): Promise<string> {
    const model = this.getModel({ temperature: 0 });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }
}
