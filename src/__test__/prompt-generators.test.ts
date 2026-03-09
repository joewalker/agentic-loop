import {
  createPromptGenerator,
  DEFAULT_PROMPT_GENERATOR,
  promptGeneratorTypes,
} from 'agentic-loop/prompt-generators/prompt-generators';
import { describe, expect, it } from 'vitest';

describe('promptGeneratorTypes', () => {
  it('should include per-file-react, per-file-security, and default', () => {
    expect(promptGeneratorTypes).toContain('per-file-react');
    expect(promptGeneratorTypes).toContain('per-file-security');
    expect(promptGeneratorTypes).toContain('default');
  });
});

describe('DEFAULT_PROMPT_GENERATOR', () => {
  it('should be "default"', () => {
    expect(DEFAULT_PROMPT_GENERATOR).toBe('default');
  });
});

describe('createPromptGenerator', () => {
  it('should create the default generator when no type is given', () => {
    const generator = createPromptGenerator();
    expect(generator).toBeDefined();
    expect(generator.name).toBe('per-file-react-review');
  });

  it('should create a per-file-react generator', () => {
    const generator = createPromptGenerator('per-file-react');
    expect(generator.name).toBe('per-file-react-review');
  });

  it('should create a per-file-security generator', () => {
    const generator = createPromptGenerator('per-file-security');
    expect(generator.name).toBe('per-file-security-review');
  });

  it('should return an AsyncIterable', () => {
    const generator = createPromptGenerator();
    expect(Symbol.asyncIterator in generator).toBe(true);
  });
});
