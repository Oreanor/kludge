import { GoogleGenerativeAI } from '@google/generative-ai';

export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      provider: 'gemini' as const },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', provider: 'gemini' as const },
];

export class GeminiProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *stream(
    messages: { role: 'user' | 'assistant'; content: string }[],
    modelId: string,
    systemPrompt: string,
  ): AsyncIterable<string> {
    const geminiModel = this.client.getGenerativeModel({
      model: modelId,
      systemInstruction: systemPrompt,
    });

    // Gemini uses 'model' instead of 'assistant'
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) { return; }

    const chat = geminiModel.startChat({ history });
    let result;
    try {
      result = await chat.sendMessageStream(lastMessage.content);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      throw new Error(`Gemini (${modelId}): ${msg}`);
    }

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) { yield text; }
    }
  }
}
