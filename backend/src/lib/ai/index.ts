import { GeminiProvider } from "./gemini-provider";
import type { AIProvider } from "./provider";

let provider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!provider) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in .env");
    }

    provider = new GeminiProvider();
    console.log(`[AI] Provider: ${provider.name}`);
  }
  return provider;
}

export type { AIProvider };
