/**
 * OpenRouter API Client
 * Handles all interactions with OpenRouter AI models
 */

const OPENROUTER_API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
const FRONTEND_URL = (import.meta as any).env?.VITE_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';

if (!OPENROUTER_API_KEY) {
  console.warn('⚠️ OPENROUTER_API_KEY not configured');
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionOptions {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  response_format?: { type: 'json_object' | 'text' };
}

/**
 * OpenRouter API Client
 */
export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private referer: string;

  constructor(apiKey?: string, referer?: string) {
    this.apiKey = apiKey || OPENROUTER_API_KEY || '';
    this.referer = referer || FRONTEND_URL;

    if (!this.apiKey) {
      console.error('OpenRouter API key not provided');
    }
  }

  /**
   * Call OpenRouter chat completions API
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<OpenRouterResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.referer,
        'X-Title': 'MealPrep Agent',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Simple text chat (no images)
   */
  async chat(
    systemPrompt: string,
    userMessage: string,
    model: string = 'qwen/qwen-3-8b',
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.chatCompletion({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 500,
    });

    return response.choices[0].message.content;
  }

  /**
   * Chat with conversation history
   */
  async chatWithHistory(
    systemPrompt: string,
    conversationHistory: OpenRouterMessage[],
    userMessage: string,
    model: string = 'qwen/qwen-3-8b',
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<string> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await this.chatCompletion({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 500,
    });

    return response.choices[0].message.content;
  }

  /**
   * Multimodal chat (with images)
   */
  async chatWithImages(
    systemPrompt: string,
    userMessage: string,
    images: string[],
    model: string = 'qwen/qwen-2.5-vl-7b-instruct',
    options?: { temperature?: number; max_tokens?: number; response_format?: { type: 'json_object' | 'text' } }
  ): Promise<string> {
    const userContent: MessageContent[] = [
      { type: 'text', text: userMessage },
      ...images.slice(0, 4).map(img => ({
        type: 'image_url' as const,
        image_url: { url: img },
      })),
    ];

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    const response = await this.chatCompletion({
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.max_tokens ?? 2000,
      response_format: options?.response_format,
    });

    return response.choices[0].message.content;
  }

  /**
   * JSON response (for structured output)
   */
  async chatJSON<T = any>(
    systemPrompt: string,
    userMessage: string,
    model: string = 'qwen/qwen-2.5-7b-instruct',
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<T> {
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await this.chatCompletion({
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.max_tokens ?? 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse JSON response:', content);
      throw new Error('Invalid JSON response from model');
    }
  }
}

// Export singleton instance
export const openRouterClient = new OpenRouterClient();

