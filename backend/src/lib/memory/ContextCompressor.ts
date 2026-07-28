import { MessageDocument } from "./types";
import { tokenCounter } from "./TokenCounter";

const TRIVIAL_PATTERNS = [
  /^(ok|okay|yes|yeah|no|nope|sure|alright|fine|got it|i see|thanks|thank you|thx|ty|👍|👎|😊|😂)$/i,
  /^[.!?]+$/,
  /^[🤖😊😂👍👎❤️🔥]+$/,
];

const TRIVIAL_WORDS = new Set([
  "ok",
  "okay",
  "yes",
  "yeah",
  "no",
  "nope",
  "sure",
  "alright",
  "fine",
  "got",
  "thanks",
  "thank",
  "thx",
  "ty",
  "see",
  "right",
]);

export class ContextCompressor {
  // Check if the message is not meaningful
  isTrivial(content: string): boolean {
    if (!content || content.trim().length === 0) return true;
    const trimmed = content.trim();
    for (const pattern of TRIVIAL_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }

    const words = trimmed.split(/\s+/);
    if (words.length <= 2) {
      return words.every((w) => {
        const clean = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
        return clean.length === 0 || TRIVIAL_WORDS.has(clean);
      });
    }

    return false;
  }

  // Remove unimportant messages from the list
  pruneTrivialMessages(messages: MessageDocument[]): MessageDocument[] {
    const pruned = messages.filter((msg) => !this.isTrivial(msg.content));
    const removed = messages.length - pruned.length;
    if (removed > 0) {
      console.log(`[Compressor] Pruned ${removed} trivial messages`);
    }
    return pruned;
  }

  // Reduce the conversation to fit the token limit
  compressConversation(
    messages: MessageDocument[],
    maxTokens: number,
  ): {
    compressed: MessageDocument[];
    dropped: MessageDocument[];
    tokens: number;
  } {
    const pruned = this.pruneTrivialMessages(messages);

    let totalTokens = 0;
    const result: MessageDocument[] = [];
    const reversed = [...pruned].reverse(); // Start from the most recent messages

    for (const msg of reversed) {
      const msgTokens = tokenCounter.count(msg.content);
      if (totalTokens + msgTokens > maxTokens) break;
      totalTokens += msgTokens;
      result.unshift(msg);
    }

    const dropped = pruned.filter((msg) => !result.includes(msg));

    const removed = pruned.length - result.length;
    if (removed > 0) {
      console.log(
        `[Compressor] Compressed ${removed}/${pruned.length} messages due to token budget`,
      );
    }

    return { compressed: result, dropped, tokens: totalTokens };
  }

  truncateToolResult(
    result: string,
    maxTokens: number = 500,
  ): { text: string; tokens: number; wasTruncated: boolean } {
    const tokens = tokenCounter.count(result);
    if (tokens <= maxTokens) {
      return { text: result, tokens, wasTruncated: false };
    }
    const lines = result.split("\n");
    let summary = "[File content truncated. Summary: ";
    const firstLine = lines[0]?.trim() || "";
    const previewLines = lines.slice(0, 5).join("\n");
    const lineCount = lines.length;
    summary += `${lineCount} lines, starts with "${firstLine.slice(0, 80)}"]\n\n`;
    summary += previewLines;
    if (lineCount > 5) {
      summary += `\n... (${lineCount - 5} more lines)`;
    }
    const truncatedTokens = tokenCounter.count(summary);
    return { text: summary, tokens: truncatedTokens, wasTruncated: true };
  }
}

export const contextCompressor = new ContextCompressor();
