import { generateResponse } from "./responder";
import type { IntentType } from "./intent";

export interface LLMProvider {
  generate(prompt: string): Promise<string>;
}

export class DeterministicLLM implements LLMProvider {
  constructor(
    private intent: IntentType,
    private data: Record<string, unknown>,
    private originalMessage: string
  ) {}

  async generate(_prompt: string): Promise<string> {
    return generateResponse(this.intent, this.data, this.originalMessage);
  }
}

export class OpenAILLM implements LLMProvider {
  async generate(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    // Future integration: call OpenAI API here
    return `[OpenAI response placeholder] ${prompt}`;
  }
}

export function getLLM(
  intent: IntentType,
  data: Record<string, unknown>,
  message: string
): LLMProvider {
  if (process.env.OPENAI_API_KEY) {
    return new OpenAILLM();
  }
  return new DeterministicLLM(intent, data, message);
}
