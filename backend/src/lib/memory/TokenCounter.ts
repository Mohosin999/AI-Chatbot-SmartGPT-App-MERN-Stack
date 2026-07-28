import { get_encoding, type Tiktoken } from "tiktoken";

let _encoder: Tiktoken | null = null;

const getEncoder = (): Tiktoken => {
  if (!_encoder) {
    _encoder = get_encoding("cl100k_base");
  }
  return _encoder;
};

export class TokenCounter {
  private encoder: Tiktoken;

  constructor() {
    this.encoder = getEncoder();
  }

  count(text: string): number {
    if (!text || text.length === 0) return 0;
    try {
      return this.encoder.encode(text).length;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }
}

export const tokenCounter = new TokenCounter();
