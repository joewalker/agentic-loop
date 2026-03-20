import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Prompt } from '../prompt-generators/prompt-generators.js';
import type { InvokeResult } from '../types.js';
import type { Reporter, ReporterConfig } from './reporters.js';

/**
 * Manages an append-only JSONL report file.
 *
 * Each call to `append()` serializes one JSON object to a new line.
 * The resulting file can be processed line-by-line with any standard
 * JSON tooling or streamed incrementally.
 */
export class JsonlReporter implements Reporter {
  static readonly reporterName = 'jsonl-report';

  static async create(config: ReporterConfig): Promise<JsonlReporter> {
    await mkdir(config.outputDir, { recursive: true });
    const path = join(config.outputDir, `${config.jobName}-report.jsonl`);
    return new JsonlReporter(path);
  }

  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  /**
   * Serialize a single entry as a JSON line and append it to the report file.
   */
  async append(prompt: Prompt, result: InvokeResult): Promise<void> {
    const output = `${JSON.stringify({ ...prompt, ...result })}\n`;
    await appendFile(this.#path, output);
  }
}
