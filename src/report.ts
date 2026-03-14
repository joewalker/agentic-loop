import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { Prompt } from './prompt-generators/prompt-generators.js';
import type { InvokeResult } from './types.js';

/**
 * A single entry in the report, capturing the prompt and its result.
 */
type ReportEntry = Prompt & InvokeResult;

/**
 * Escape a string value for use in a YAML block scalar. Block scalars
 * preserve content as-is, but trailing whitespace on lines can be
 * surprising so we trim each line's trailing spaces.
 */
function formatBlockScalar(value: string): string {
  return value
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

/**
 * Serialize a single ReportEntry as a YAML document (including the
 * leading `---` separator).
 */
function serializeEntry(entry: ReportEntry): string {
  const lines: Array<string> = ['---'];
  lines.push(`id: "${entry.id}"`);
  lines.push(`status: ${entry.status}`);
  lines.push('prompt: |');
  for (const line of formatBlockScalar(entry.prompt).split('\n')) {
    lines.push(line === '' ? '' : `  ${line}`);
  }

  if (entry.status === 'success') {
    lines.push('output: |');
    for (const line of formatBlockScalar(entry.output).split('\n')) {
      lines.push(line === '' ? '' : `  ${line}`);
    }
  } else {
    lines.push('reason: |');
    for (const line of formatBlockScalar(entry.reason).split('\n')) {
      lines.push(line === '' ? '' : `  ${line}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Manages an append-only YAML document stream report file.
 *
 * Each call to `append()` adds a new YAML document (`---` delimited)
 * to the file. The resulting file is both human-readable and trivially
 * parseable by any YAML multi-document loader.
 */
export class Report {
  #path: string;

  constructor(path: string) {
    this.#path = path;
  }

  get path(): string {
    return this.#path;
  }

  /**
   * Append a report entry to the file. Creates the file (and parent
   * directories) if they don't exist yet.
   */
  async append(prompt: Prompt, result: InvokeResult): Promise<void> {
    const entry = { ...prompt, ...result };

    await mkdir(dirname(this.#path), { recursive: true });

    const serialized = serializeEntry(entry);
    await appendFile(this.#path, serialized);
  }
}
