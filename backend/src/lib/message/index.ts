import Chat from "../../models/Chat";
import User from "../../models/User";
import { getAIProvider } from "../ai";
import type { GenerationConfig } from "../../types/common";
import { notFound } from "../../utils/error";
import { contextCompressor } from "../memory/ContextCompressor";
import { contextBudget } from "../memory/ContextBudget";
import { tokenCounter } from "../memory/TokenCounter";
import type { FileInput } from "../../validators/chat";
import {
  getToolDefinitions,
  getToolDefinitionsByNames,
  executeTool,
} from "../ai/tools";

const provider = getAIProvider();

const generateChatTitle = async (
  userPrompt: string,
): Promise<string | null> => {
  try {
    const titlePrompt = `You are a strict title generator. Your only job: generate EXACTLY 3-4 words as a chat title. No extra text, no explanations, no punctuation, no quotes, no emojis. Title case. Return ONLY the title.\n\nUser message: ${userPrompt}`;
    return await provider.generateContentText(titlePrompt);
  } catch (err) {
    console.error("Failed to generate chat title:", (err as Error).message);
    return null;
  }
};

const summarizeConversation = async (
  messages: { role: string; content: string }[],
): Promise<string> => {
  const text = messages
    .map((m) => `[${m.role}]: ${m.content.slice(0, 300)}`)
    .join("\n");

  const prompt = `Summarize this conversation in 2 sentences. Focus on topics discussed and any key information about the user.\n\n${text}`;
  try {
    return await provider.generateContentText(prompt);
  } catch {
    return "";
  }
};

/*
 * streamMessage — the core message pipeline.
 *
 * New optional params:
 *   schema    — JSON Schema for structured output (JSON mode). Give this when
 *               you want the AI to return a specific JSON structure.
 *   tools     — Array of tool names to enable (e.g., ["calculator", "get_current_time"]).
 *               If empty or omitted, no tools are passed to the AI.
 */
const streamMessage = async ({
  userId,
  chatId,
  prompt,
  files,
  signal,
  schema,
  tools: toolNames,
}: {
  userId: string;
  chatId: string;
  prompt: string;
  files?: FileInput[];
  signal?: AbortSignal;
  schema?: Record<string, unknown>;
  tools?: string[];
}) => {
  const chat = await Chat.findOne({ userId, _id: chatId });
  if (!chat) throw notFound();

  const userMessage: Record<string, unknown> = {
    role: "user",
    content: prompt,
    timestamp: Date.now(),
  };

  if (files && files.length > 0) {
    userMessage.files = files.map((f) => ({
      mimeType: f.mimeType,
      name: f.name,
    }));

    for (const f of files) {
      const truncated = contextCompressor.truncateToolResult(
        `File: ${f.name} (${f.mimeType})`,
        100,
      );
      userMessage.fileSummary = truncated.text;
    }
  }

  chat.messages.push(userMessage as any);

  const needsTitle =
    !chat.name || /^(new chat|untitled)/i.test(chat.name.trim());

  const titleText = prompt || (files?.length ? files[0].name : "New chat");

  const titlePromise = needsTitle
    ? generateChatTitle(titleText)
    : Promise.resolve(null);

  const budget = contextBudget.allocate();

  const { compressed: prunedMessages, dropped: droppedMessages } =
    contextCompressor.compressConversation(
      chat.messages as any,
      budget.history,
    );

  let droppedSummary = "";
  if (droppedMessages.length > 0) {
    droppedSummary = await summarizeConversation(
      droppedMessages.map((m) => ({ role: m.role, content: m.content })) as any,
    );
  }

  const userData = await User.findById(userId)
    .select("customInstructions")
    .lean();
  const customInstr = userData?.customInstructions?.trim();
  const systemPrompt = `You are an AI assistant helping ${chat.userName}. Be helpful, accurate, and concise.${customInstr ? `\n\n[User Instructions]\n${customInstr}` : ""}`;

  const contents: { role: string; parts: { text: string }[] }[] = [
    {
      role: "user",
      parts: [{ text: `[System Context]\n${systemPrompt}` }],
    },
  ];

  if (droppedSummary) {
    contents.push({
      role: "user",
      parts: [{ text: `[Earlier context]: ${droppedSummary}` }],
    });
  }

  const historyMessages = prunedMessages.slice(0, -1);
  for (const msg of historyMessages) {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.content }],
    });
  }

  const needsToolTruncation = files && files.length > 0;
  let toolTruncationNote = "";
  if (needsToolTruncation) {
    toolTruncationNote = `\n[Note: ${files!.length} file(s) attached. Key information extracted where possible.]\n`;
  }

  const currentPrompt =
    prompt || (files?.length ? "Analyze the attached file(s)" : "");
  const finalPrompt = currentPrompt + toolTruncationNote;

  contents.push({
    role: "user",
    parts: [{ text: finalPrompt }],
  });

  // ---------- Build generation config for JSON mode ----------
  const genConfig: GenerationConfig | undefined = schema
    ? {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    : undefined;

  // ---------- Build tools list from requested names ----------
  const tools =
    toolNames && toolNames.length > 0
      ? getToolDefinitionsByNames(toolNames)
      : undefined;

  // ---------- Token budget logging (unchanged) ----------
  let tokenBudget = budget.total;
  const systemTokens = tokenCounter.count(systemPrompt);
  const historyTokens = tokenCounter.count(
    historyMessages.map((m) => m.content).join(" "),
  );
  const promptTokens = tokenCounter.count(finalPrompt);
  tokenBudget -= systemTokens + historyTokens + promptTokens;

  if (tokenBudget < 100) {
    console.log(
      `[ContextBudget] Warning: only ${tokenBudget} tokens remaining for response`,
    );
  }

  contextBudget.logBudgetAllocation(budget, {
    system: systemTokens,
    history: historyTokens,
    prompt: promptTokens,
    total: systemTokens + historyTokens + promptTokens,
  });

  // ---------- Call AI provider with config + tools ----------
  const genStream = provider.generateContentStream(contents, signal, {
    config: genConfig,
    tools,
    /*
     * When the AI calls a tool, this callback runs the tool and returns the result.
     * The provider handles the loop automatically (call → result → final response).
     */
    onFunctionCall: async (call) => {
      return executeTool(call);
    },
  });

  let fullText = "";

  const stream = (async function* () {
    for await (const chunk of genStream) {
      if (signal?.aborted) break;
      fullText += chunk;
      yield chunk;
    }
  })();

  const complete = async () => {
    const reply: Record<string, unknown> = {
      role: "assistant",
      content: fullText,
      timestamp: Date.now(),
    };

    chat.messages.push(reply as any);

    const generatedTitle = await titlePromise;
    if (generatedTitle) {
      chat.name = generatedTitle;
      reply.chatName = generatedTitle;
    }

    await chat.save();

    // Return the user message _id so the frontend can sync it
    const userMessage = chat.messages[chat.messages.length - 2];
    if (userMessage && userMessage._id) {
      reply.userMessageId = userMessage._id.toString();
    }

    return reply;
  };

  return { stream, complete };
};

/*
 * streamEditMessage — edit an existing user message and re-stream.
 *
 * Updates the message content, removes subsequent messages, then
 * streams a fresh AI response using the updated conversation history.
 */
const streamEditMessage = async ({
  userId,
  chatId,
  messageId,
  prompt,
  signal,
}: {
  userId: string;
  chatId: string;
  messageId: string;
  prompt: string;
  signal?: AbortSignal;
}) => {
  const chat = await Chat.findOne({ userId, _id: chatId });
  if (!chat) throw notFound();

  // Find and update the message, remove all messages after it
  const msgIndex = chat.messages.findIndex(
    (msg) => msg._id?.toString() === messageId,
  );
  if (msgIndex === -1) throw notFound();

  chat.messages[msgIndex].content = prompt;
  chat.messages = chat.messages.slice(0, msgIndex + 1);
  chat.markModified("messages");

  const needsTitle =
    !chat.name || /^(new chat|untitled)/i.test(chat.name.trim());
  const titlePromise = needsTitle
    ? generateChatTitle(prompt)
    : Promise.resolve(null);

  const budget = contextBudget.allocate();

  const { compressed: prunedMessages, dropped: droppedMessages } =
    contextCompressor.compressConversation(
      chat.messages as any,
      budget.history,
    );

  let droppedSummary = "";
  if (droppedMessages.length > 0) {
    droppedSummary = await summarizeConversation(
      droppedMessages.map((m) => ({ role: m.role, content: m.content })) as any,
    );
  }

  const userData = await User.findById(userId)
    .select("customInstructions")
    .lean();
  const customInstr = userData?.customInstructions?.trim();
  const systemPrompt = `You are an AI assistant helping ${chat.userName}. Be helpful, accurate, and concise.${customInstr ? `\n\n[User Instructions]\n${customInstr}` : ""}`;

  const contents: { role: string; parts: { text: string }[] }[] = [
    {
      role: "user",
      parts: [{ text: `[System Context]\n${systemPrompt}` }],
    },
  ];

  if (droppedSummary) {
    contents.push({
      role: "user",
      parts: [{ text: `[Earlier context]: ${droppedSummary}` }],
    });
  }

  const historyMessages = prunedMessages.slice(0, -1);
  for (const msg of historyMessages) {
    contents.push({
      role: msg.role,
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  // Token budget logging
  let tokenBudget = budget.total;
  const systemTokens = tokenCounter.count(systemPrompt);
  const historyTokens = tokenCounter.count(
    historyMessages.map((m) => m.content).join(" "),
  );
  const promptTokens = tokenCounter.count(prompt);
  tokenBudget -= systemTokens + historyTokens + promptTokens;

  if (tokenBudget < 100) {
    console.log(
      `[ContextBudget] Warning: only ${tokenBudget} tokens remaining for response`,
    );
  }

  contextBudget.logBudgetAllocation(budget, {
    system: systemTokens,
    history: historyTokens,
    prompt: promptTokens,
    total: systemTokens + historyTokens + promptTokens,
  });

  const genStream = provider.generateContentStream(contents, signal, {
    onFunctionCall: async (call) => {
      return executeTool(call);
    },
  });

  let fullText = "";

  const stream = (async function* () {
    for await (const chunk of genStream) {
      if (signal?.aborted) break;
      fullText += chunk;
      yield chunk;
    }
  })();

  const complete = async () => {
    const reply: Record<string, unknown> = {
      role: "assistant",
      content: fullText,
      timestamp: Date.now(),
    };

    chat.messages.push(reply as any);

    const generatedTitle = await titlePromise;
    if (generatedTitle) {
      chat.name = generatedTitle;
      reply.chatName = generatedTitle;
    }
    await chat.save();

    // Return the user message _id so the frontend can sync it
    const userMessage = chat.messages[chat.messages.length - 2];
    if (userMessage && userMessage._id) {
      reply.userMessageId = userMessage._id.toString();
    }

    return reply;
  };

  return { stream, complete };
};

export { streamMessage, streamEditMessage };
