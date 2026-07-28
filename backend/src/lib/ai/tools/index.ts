import { RegisteredTool, ToolCall, ToolDefinition, ToolExecutor, ToolResult } from "../types";

const registry = new Map<string, RegisteredTool>();

export function registerTool(
  name: string,
  definition: ToolDefinition,
  execute: ToolExecutor,
): void {
  registry.set(name, { definition, execute });
}

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(registry.values()).map((t) => t.definition);
}

export function getToolDefinitionsByNames(names: string[]): ToolDefinition[] {
  return names
    .map((name) => registry.get(name)?.definition)
    .filter((t): t is ToolDefinition => !!t);
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = registry.get(call.name);
  if (!tool) {
    return {
      name: call.name,
      result: JSON.stringify({
        error: `Unknown tool: "${call.name}". Available: ${Array.from(registry.keys()).join(", ")}`,
      }),
      id: call.id,
    };
  }

  try {
    const args = JSON.parse(call.args);
    const result = await tool.execute(args);
    return { name: call.name, result, id: call.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: call.name,
      result: JSON.stringify({ error: message }),
      id: call.id,
    };
  }
}

// ======================== Built-in Tools ========================

/*
 * get_current_time — Returns the current date and time in the requested language.
 * Supports English (en), Bengali (bn), and Arabic (ar).
 */
registerTool(
  "get_current_time",
  {
    function: {
      name: "get_current_time",
      description:
        "Get the current date and time. Supports English (en), Bengali (bn), and Arabic (ar).",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            description:
              "Language code: 'en' for English, 'bn' for Bengali, 'ar' for Arabic. Defaults to 'en'.",
            enum: ["en", "bn", "ar"],
          },
        },
        required: [],
      },
    },
  },
  async (args) => {
    const { language } = args as { language?: string };
    const locale =
      language === "bn" ? "bn-BD" : language === "ar" ? "ar-SA" : "en-US";
    const now = new Date();

    const dateStr = now.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeStr = now.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return JSON.stringify({
      datetime: now.toISOString(),
      timezone: tz,
      formatted: `${dateStr}, ${timeStr}`,
      language,
    });
  },
);

/*
 * calculator — Safely evaluates a math expression.
 * Only allows numbers, +, -, *, /, parentheses, dots, and spaces.
 * No letters = no code injection.
 */
registerTool(
  "calculator",
  {
    function: {
      name: "calculator",
      description:
        "Evaluate a mathematical expression. Supports +, -, *, /, parentheses, and decimal numbers.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "The math expression to evaluate, e.g. '2 + 2' or '(15 * 3) / 5'",
          },
        },
        required: ["expression"],
      },
    },
  },
  async (args) => {
    const { expression } = args as { expression: string };
    // Remove spaces
    const sanitized = String(expression).replace(/\s/g, "");
    // Only allow digits, math operators, parens, dots, percent
    if (!/^[\d+\-*/().%]+$/.test(sanitized)) {
      return JSON.stringify({
        error: "Invalid expression. Use only numbers and +, -, *, /, (, )",
      });
    }
    try {
      // Safe because regex only allows numbers and operators — no letters = no code
      const result = Function(`"use strict"; return (${sanitized})`)();
      return JSON.stringify({ expression: sanitized, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: message });
    }
  },
);
