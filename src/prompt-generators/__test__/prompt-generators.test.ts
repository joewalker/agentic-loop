import type { PerFileTask } from 'loop-the-loop/prompt-generators/per-file';
import {
  createPromptGenerator,
  promptGeneratorTypes,
} from 'loop-the-loop/prompt-generators';
import { describe, expect, it } from 'vitest';

const task: PerFileTask = {
  filePattern: 'src/**/*.tsx',
  excludePatterns: ['**/__test__/**'],
  promptTemplate: 'Review {{file}}',
};

describe('promptGeneratorTypes', () => {
  it('should include per-file', () => {
    expect(promptGeneratorTypes).toContain('per-file');
  });
});

describe('createPromptGenerator', () => {
  it('should return a PromptGenerator with generate()', async () => {
    const generator = await createPromptGenerator(['per-file', task]);
    expect(typeof generator.generate).toBe('function');
  });
});
