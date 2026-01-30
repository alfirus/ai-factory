import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { config } from '../utils/config.js';
import { withTimeout } from '../utils/timeout.js';
import { logger } from '../utils/logger.js';
import { AIFactoryError } from '../utils/errors.js';
import { AIProvider, ChatOptions, ChatMessage } from './base.js';

class GeminiProvider implements AIProvider {
	public name = 'gemini';
	public defaultModel = config.GEMINI_DEFAULT_MODEL;
	private client: GoogleGenerativeAI | null = null;

	isAvailable(): boolean {
		return !!config.GEMINI_API_KEY;
	}

	private getClient(): GoogleGenerativeAI {
		if (!this.client) {
			this.client = new GoogleGenerativeAI(config.GEMINI_API_KEY);
		}
		return this.client;
	}

	async chat(messages: string | ChatMessage[], options: ChatOptions = {}): Promise<string> {
		if (!this.isAvailable()) {
			throw new AIFactoryError('Gemini API key not configured', 'PROVIDER_UNAVAILABLE');
		}

		try {
			const client = this.getClient();
			const model = options.model || this.defaultModel;

			// Convert messages to Gemini format
			const contents: Content[] = [];

			if (typeof messages === 'string') {
				contents.push({
					role: 'user',
					parts: [{ text: messages }],
				});
			} else {
				for (const msg of messages) {
					contents.push({
						role: msg.role === 'assistant' ? 'model' : msg.role,
						parts: [{ text: msg.content }],
					});
				}
			}

			const result = await withTimeout(
				client.models.generateContent({
					model,
					contents,
					generationConfig: {
						temperature: options.temperature,
						maxOutputTokens: options.maxTokens,
					},
					systemInstruction: options.systemPrompt,
				}),
			);

			const response = result.response.text();
			logger.debug(`Gemini response received for model ${model}`);
			return response;
		} catch (error) {
			logger.error('Gemini API error', error);
			if (error instanceof AIFactoryError) throw error;
			throw new AIFactoryError(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`, 'GEMINI_ERROR');
		}
	}
}

export default new GeminiProvider();
