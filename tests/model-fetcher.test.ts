import { describe, expect, it } from 'vitest';
import {
  filterAnthropicModels,
  filterCustomModels,
  filterDeepSeekModels,
  filterGeminiModels,
  filterOllamaModels,
  filterOpenAIModels,
  filterOpenRouterModels,
  filterPerplexityModels,
  filterXAIModels,
} from '../src/lib/llm/model-fetcher';

describe('model-fetcher text-generation filtering', () => {
  it('filterGeminiModels filters non-text, experimental, developer tools, and canonicalizes snapshots', () => {
    const payload = {
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-1.5-flash-001',
          displayName: 'Gemini 1.5 Flash 001',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-2.0-flash-thinking-exp-01-21',
          displayName: 'Thinking Exp',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-exp-1206',
          displayName: 'Gemini Exp',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/aqa',
          displayName: 'AQA Model',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/learnlm-1.5-pro-experimental',
          displayName: 'LearnLM',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/chat-bison-001',
          displayName: 'PaLM Chat Bison',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/text-embedding-004',
          displayName: 'Text Embedding 004',
          supportedGenerationMethods: ['embedContent'],
        },
      ],
    };

    const result = filterGeminiModels(payload);
    const ids = result.map((m) => m.id);

    // Should include canonical text generation models
    expect(ids).toContain('gemini-2.5-flash');
    expect(ids).toContain('gemini-1.5-flash'); // Canonicalized from -001

    // Should exclude developer/experimental/legacy/embeddings
    expect(ids).not.toContain('gemini-2.0-flash-thinking-exp-01-21');
    expect(ids).not.toContain('gemini-exp-1206');
    expect(ids).not.toContain('aqa');
    expect(ids).not.toContain('learnlm-1.5-pro-experimental');
    expect(ids).not.toContain('chat-bison-001');
    expect(ids).not.toContain('text-embedding-004');
  });

  it('filterOpenAIModels excludes developer date snapshots, audio, realtime, and previews', () => {
    const payload = {
      data: [
        { id: 'gpt-4o' },
        { id: 'gpt-4o-mini' },
        { id: 'gpt-4o-2024-08-06' }, // Developer date snapshot
        { id: 'gpt-4-0613' }, // Developer date snapshot
        { id: 'gpt-4o-realtime-preview' }, // Realtime audio/developer preview
        { id: 'gpt-4o-audio-preview' },
        { id: 'gpt-3.5-turbo-instruct' }, // Legacy completion
        { id: 'o3-mini' },
        { id: 'o1' },
        { id: 'text-embedding-3-large' },
        { id: 'tts-1' },
        { id: 'whisper-1' },
        { id: 'dall-e-3' },
      ],
    };

    const result = filterOpenAIModels(payload);
    const ids = result.map((m) => m.id);

    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gpt-4o-mini');
    expect(ids).toContain('o3-mini');
    expect(ids).toContain('o1');

    // All developer snapshots and non-text models must be excluded
    expect(ids).not.toContain('gpt-4o-2024-08-06');
    expect(ids).not.toContain('gpt-4-0613');
    expect(ids).not.toContain('gpt-4o-realtime-preview');
    expect(ids).not.toContain('gpt-4o-audio-preview');
    expect(ids).not.toContain('gpt-3.5-turbo-instruct');
    expect(ids).not.toContain('text-embedding-3-large');
    expect(ids).not.toContain('tts-1');
    expect(ids).not.toContain('whisper-1');
  });

  it('filterAnthropicModels picks the latest release per family and excludes legacy models', () => {
    const payload = {
      data: [
        { id: 'claude-3-5-sonnet-20241022', display_name: 'Claude 3.5 Sonnet (Newer)', type: 'model' },
        { id: 'claude-3-5-sonnet-20240620', display_name: 'Claude 3.5 Sonnet (Older)', type: 'model' },
        { id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku', type: 'model' },
        { id: 'claude-2.1', display_name: 'Claude 2.1', type: 'model' }, // Legacy developer model
        { id: 'claude-instant-1.2', display_name: 'Claude Instant', type: 'model' },
      ],
    };

    const result = filterAnthropicModels(payload);
    const ids = result.map((m) => m.id);

    // Keeps only the latest 3.5 Sonnet
    expect(ids).toContain('claude-3-5-sonnet-20241022');
    expect(ids).not.toContain('claude-3-5-sonnet-20240620');

    // Keeps 3.5 Haiku
    expect(ids).toContain('claude-3-5-haiku-20241022');

    // Excludes legacy
    expect(ids).not.toContain('claude-2.1');
    expect(ids).not.toContain('claude-instant-1.2');
  });

  it('filterOpenRouterModels excludes code, image, audio, and developer base models', () => {
    const payload = {
      data: [
        { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
        { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'deepseek/deepseek-coder-v2', name: 'DeepSeek Coder' }, // Code developer model
        { id: 'qwen/qwen-2.5-coder-32b', name: 'Qwen Coder' }, // Code developer model
        { id: 'black-forest-labs/flux-1-schnell', name: 'Flux 1' }, // Image generation
        { id: 'openai/whisper-large-v3', name: 'Whisper' }, // Audio
        { id: 'openai/text-embedding-3-small', name: 'Embeddings' },
        { id: 'meta-llama/llama-3-8b-base', name: 'Llama Base' }, // Base foundation model
      ],
    };

    const result = filterOpenRouterModels(payload);
    const ids = result.map((m) => m.id);

    expect(ids[0]).toBe('openrouter/auto');
    expect(ids[1]).toBe('openrouter/free');
    expect(ids).toContain('meta-llama/llama-3.3-70b-instruct');
    expect(ids).toContain('google/gemini-2.5-flash');

    expect(ids).not.toContain('deepseek/deepseek-coder-v2');
    expect(ids).not.toContain('qwen/qwen-2.5-coder-32b');
    expect(ids).not.toContain('black-forest-labs/flux-1-schnell');
    expect(ids).not.toContain('openai/whisper-large-v3');
    expect(ids).not.toContain('openai/text-embedding-3-small');
    expect(ids).not.toContain('meta-llama/llama-3-8b-base');
  });

  it('filterDeepSeekModels excludes coder models', () => {
    const payload = {
      data: [
        { id: 'deepseek-chat' },
        { id: 'deepseek-reasoner' },
        { id: 'deepseek-coder' },
      ],
    };

    const result = filterDeepSeekModels(payload);
    const ids = result.map((m) => m.id);
    expect(ids).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('filterPerplexityModels retains Sonar text models', () => {
    const payload = {
      data: [
        { id: 'sonar-pro' },
        { id: 'sonar' },
        { id: 'sonar-reasoning-pro' },
        { id: 'other-embed' },
      ],
    };

    const result = filterPerplexityModels(payload);
    const ids = result.map((m) => m.id);
    expect(ids).toEqual(['sonar-pro', 'sonar', 'sonar-reasoning-pro']);
  });

  it('filterXAIModels keeps grok text models and excludes vision/build/date snapshots', () => {
    const payload = {
      data: [
        { id: 'grok-2' },
        { id: 'grok-2-mini' },
        { id: 'grok-vision-beta' },
        { id: 'grok-build-0.1' },
        { id: 'grok-2-2024-12-01' },
      ],
    };

    const result = filterXAIModels(payload);
    const ids = result.map((m) => m.id);
    expect(ids).toEqual(['grok-2', 'grok-2-mini']);
  });

  it('filterOllamaModels parses /v1/models and /api/tags while excluding embeddings', () => {
    const v1Payload = {
      data: [
        { id: 'llama3.2:latest' },
        { id: 'mistral:latest' },
        { id: 'nomic-embed-text:latest' },
        { id: 'bge-m3:latest' },
      ],
    };

    const v1Result = filterOllamaModels(v1Payload);
    expect(v1Result.map((m) => m.id)).toEqual(['llama3.2:latest', 'mistral:latest']);
    expect(v1Result[0].label).toBe('Llama3.2');

    const nativePayload = {
      models: [
        { name: 'phi4:latest' },
        { name: 'qwen2.5:latest' },
        { name: 'mxbai-embed-large:latest' },
      ],
    };

    const nativeResult = filterOllamaModels(nativePayload);
    expect(nativeResult.map((m) => m.id)).toEqual(['phi4:latest', 'qwen2.5:latest']);
    expect(nativeResult[0].label).toBe('Phi4');
  });

  it('filterCustomModels extracts models and excludes embeddings/audio', () => {
    const payload = {
      data: [
        { id: 'my-custom-model', name: 'My Custom Model' },
        { id: 'text-embedding-custom' },
        { id: 'whisper-local' },
      ],
    };

    const result = filterCustomModels(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'my-custom-model',
      label: 'My Custom Model',
    });
  });

  it('filterCustomModels handles OpenCode format with providerID and type filtering', () => {
    const openCodePayload = {
      data: [
        {
          id: 'gemini-2.5-flash',
          modelID: 'gemini-2.5-flash',
          providerID: 'google',
          type: 'chat',
          name: 'Gemini 2.5 Flash',
          enabled: true,
          status: 'active',
        },
        {
          id: 'text-embedding-004',
          providerID: 'google',
          type: 'embedding', // Must be excluded
          enabled: true,
        },
        {
          id: 'deprecated-chat',
          providerID: 'google',
          type: 'chat',
          status: 'deprecated', // Must be excluded
        },
        {
          id: 'disabled-model',
          providerID: 'opencode',
          type: 'chat',
          enabled: false, // Must be excluded
        },
        {
          id: 'gpt-4o',
          providerID: 'openai',
          type: 'chat',
          name: 'GPT-4o',
          enabled: true,
        },
      ],
    };

    const result = filterCustomModels(openCodePayload);
    expect(result.map((m) => m.id)).toEqual(['google/gemini-2.5-flash', 'openai/gpt-4o']);
    expect(result[0].label).toBe('Gemini 2.5 Flash (google)');
    expect(result[1].label).toBe('GPT-4o (openai)');
  });
});
