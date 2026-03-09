import {
  buildPrompt,
  type PerFileAgenticTask,
  PerFilePromptGenerator,
  resolveFiles,
} from 'agentic-loop/prompt-generators/per-file';
import type { Prompt } from 'agentic-loop/prompt-generators/prompt-generators';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('buildPrompt', () => {
  it('should substitute {{file}} in the template', () => {
    const task: PerFileAgenticTask = {
      name: 'test',
      filePattern: '**/*.ts',
      promptTemplate: 'Review the file {{file}} for issues.',
    };
    const result = buildPrompt(task, 'src/foo.ts');
    expect(result).toBe('Review the file src/foo.ts for issues.');
  });

  it('should substitute multiple occurrences of {{file}}', () => {
    const task: PerFileAgenticTask = {
      name: 'test',
      filePattern: '**/*.ts',
      promptTemplate: 'Check {{file}}. The file {{file}} needs review.',
    };
    const result = buildPrompt(task, 'bar.ts');
    expect(result).toBe('Check bar.ts. The file bar.ts needs review.');
  });

  it('should append context files when present', () => {
    const task: PerFileAgenticTask = {
      name: 'test',
      filePattern: '**/*.ts',
      promptTemplate: 'Review {{file}}.',
      contextFiles: ['GUIDELINES.md', 'RULES.md'],
    };
    const result = buildPrompt(task, 'src/app.ts');
    expect(result).toContain('Review src/app.ts.');
    expect(result).toContain('Additional context files:');
    expect(result).toContain('- GUIDELINES.md');
    expect(result).toContain('- RULES.md');
  });

  it('should not append context section when contextFiles is empty', () => {
    const task: PerFileAgenticTask = {
      name: 'test',
      filePattern: '**/*.ts',
      promptTemplate: 'Review {{file}}.',
      contextFiles: [],
    };
    const result = buildPrompt(task, 'src/app.ts');
    expect(result).toBe('Review src/app.ts.');
  });
});

describe('resolveFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'resolve-files-'));
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await mkdir(join(tempDir, '__test__'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'a.ts'), '');
    await writeFile(join(tempDir, 'src', 'b.ts'), '');
    await writeFile(join(tempDir, '__test__', 'c.test.ts'), '');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should resolve files matching a glob pattern', async () => {
    const files = await resolveFiles(join(tempDir, '**/*.ts'));
    expect(files).toHaveLength(3);
  });

  it('should return files in sorted order', async () => {
    const files = await resolveFiles(join(tempDir, 'src/*.ts'));
    const filenames = files.map(f => f.split('/').pop());
    expect(filenames).toStrictEqual(['a.ts', 'b.ts']);
  });

  it('should exclude files matching exclude patterns', async () => {
    const files = await resolveFiles(join(tempDir, '**/*.ts'), [
      '**/__test__/**',
    ]);
    expect(files).toHaveLength(2);
    expect(files.every(f => !f.includes('__test__'))).toBe(true);
  });

  it('should return an empty array when no files match', async () => {
    const files = await resolveFiles(join(tempDir, '**/*.xyz'));
    expect(files).toStrictEqual([]);
  });
});

describe('PerFilePromptGenerator', () => {
  let tempDir: string;
  const stateFiles: Array<string> = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'per-file-gen-'));
    await writeFile(join(tempDir, 'file1.ts'), '');
    await writeFile(join(tempDir, 'file2.ts'), '');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    // Clean up state files written by the generator
    for (const f of stateFiles) {
      await rm(f, { force: true });
    }
    stateFiles.length = 0;
  });

  it('should have the correct name', () => {
    const task: PerFileAgenticTask = {
      name: 'my-task',
      filePattern: '**/*.ts',
      promptTemplate: 'Review {{file}}',
    };
    const generator = new PerFilePromptGenerator(task);
    expect(generator.name).toBe('per-file-my-task');
  });

  it('should yield prompts for each matching file', async () => {
    const name = 'iter-test';
    stateFiles.push(join('cache/agentic-loops', `${name}.state.json`));
    const task: PerFileAgenticTask = {
      name,
      filePattern: join(tempDir, '*.ts'),
      promptTemplate: 'Review {{file}}',
    };
    const generator = new PerFilePromptGenerator(task);
    const prompts: Array<Prompt> = [];

    for await (const prompt of generator) {
      prompts.push(prompt);
      // Record success so the loop progresses
      await prompt.recordResult({ status: 'success', output: 'ok' });
    }

    expect(prompts).toHaveLength(2);
    expect(prompts[0].id).toContain('file1.ts');
    expect(prompts[1].id).toContain('file2.ts');
  });

  it('should skip files that errored on recordResult', async () => {
    const name = 'error-test';
    stateFiles.push(join('cache/agentic-loops', `${name}.state.json`));
    const task: PerFileAgenticTask = {
      name,
      filePattern: join(tempDir, '*.ts'),
      promptTemplate: 'Review {{file}}',
    };
    const generator = new PerFilePromptGenerator(task);
    const prompts: Array<Prompt> = [];

    for await (const prompt of generator) {
      prompts.push(prompt);
      // Mark first as error, second as success
      if (prompts.length === 1) {
        await prompt.recordResult({ status: 'error', reason: 'bad file' });
      } else {
        await prompt.recordResult({ status: 'success', output: 'ok' });
      }
    }

    // Both files should be yielded (errors are recorded but don't prevent iteration)
    expect(prompts).toHaveLength(2);
  });

  it('should yield no prompts when no files match', async () => {
    const name = 'empty-test';
    stateFiles.push(join('cache/agentic-loops', `${name}.state.json`));
    const task: PerFileAgenticTask = {
      name,
      filePattern: join(tempDir, '*.xyz'),
      promptTemplate: 'Review {{file}}',
    };
    const generator = new PerFilePromptGenerator(task);
    const prompts: Array<Prompt> = [];

    for await (const prompt of generator) {
      prompts.push(prompt);
    }

    expect(prompts).toStrictEqual([]);
  });
});
