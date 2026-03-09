import { glob } from 'glob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { InvokeResult } from '../types.js';
import type { Prompt, PromptGenerator } from './prompt-generators.js';

/**
 * Configuration for a single agentic loop task. Describes which files to
 * process, what prompt to send for each one, and where to write the report.
 */
export interface PerFileAgenticTask {
  /**
   * A short identifier for this task, used in state file names
   */
  name: string;

  /**
   * Glob pattern for files to process
   */
  filePattern: string;

  /**
   * Optional glob patterns to exclude
   */
  excludePatterns?: Array<string>;

  /**
   * How should we construct a prompt for the given file. During processing,
   * {{file}} is replaced with the file path.
   */
  promptTemplate: string;

  /**
   * Additional files to add to the prompt context
   */
  contextFiles?: Array<string>;
}

const STATE_DIR = 'cache/agentic-loops';

/**
 * A PromptGenerator that works on a template that iterates over a subset of
 * files in the filesystem
 */
export class PerFilePromptGenerator implements PromptGenerator {
  readonly name;
  readonly #task: PerFileAgenticTask;

  constructor(task: PerFileAgenticTask) {
    this.name = `per-file-${task.name}`;
    this.#task = task;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Prompt> {
    const allFiles = await resolveFiles(
      this.#task.filePattern,
      this.#task.excludePatterns,
    );
    const path = join(STATE_DIR, `${this.#task.name}.state.json`);
    const loopState = await createLoopState(path, allFiles);
    const task = this.#task;

    while (true) {
      const file = calculateNextRemaining(loopState);
      if (file == null) {
        break;
      }

      loopState.inProgressFile = file;
      await saveLoopState(loopState, path);

      yield {
        id: file,
        prompt: buildPrompt(task, file),
        async recordResult(result: InvokeResult) {
          if (result.status === 'success') {
            loopState.completedFiles.push(file);
          }
          if (result.status === 'error') {
            loopState.failedFiles.push({ file, reason: result.reason });
          }

          delete loopState.inProgressFile;
          await saveLoopState(loopState, path);
        },
      };
    }
  }
}

/**
 * Build the full prompt for a single file by substituting `{{file}}` in the
 * template and appending any context file references.
 */
export function buildPrompt(task: PerFileAgenticTask, file: string): string {
  let prompt = task.promptTemplate.replaceAll('{{file}}', file);

  if (task.contextFiles && task.contextFiles.length > 0) {
    prompt += '\n\nAdditional context files:\n';
    for (const contextFile of task.contextFiles) {
      prompt += `- ${contextFile}\n`;
    }
  }

  return prompt;
}

/**
 * Compute the files remaining to be processed
 */
function calculateNextRemaining(state: LoopState): string | undefined {
  const done = new Set(state.completedFiles);
  const failed = new Set(state.failedFiles.map(f => f.file));
  const remaining = state.allFiles.filter(f => {
    return !done.has(f) && !failed.has(f);
  });

  // If the previous run was interrupted mid-file, put that file back at the front
  if (
    state.inProgressFile &&
    !done.has(state.inProgressFile) &&
    !failed.has(state.inProgressFile)
  ) {
    const idx = remaining.indexOf(state.inProgressFile);
    if (idx > 0) {
      remaining.splice(idx, 1);
      remaining.unshift(state.inProgressFile);
    }
  }

  return remaining[0];
}

/**
 * Resolve a glob pattern into an ordered list of file paths, excluding
 * any files that match the exclusion patterns.
 */
export async function resolveFiles(
  filePattern: string,
  excludePatterns?: Array<string>,
): Promise<Array<string>> {
  const files = await glob(filePattern, {
    ...(excludePatterns ? { ignore: excludePatterns } : {}),
    nodir: true,
  });

  // Sort for deterministic processing order
  files.sort();
  return files;
}

/**
 * Persisted state for a running or interrupted agentic loop. Saved before and
 * after every prompt execution so that any interruption loses at most one
 * file's work.
 */
interface LoopState {
  /**
   * The full resolved file list (in processing order)
   */
  allFiles: Array<string>;

  /**
   * The file currently being processed (if any)
   */
  inProgressFile?: string;

  /**
   * Files that have been successfully processed
   */
  completedFiles: Array<string>;

  /**
   * Files that failed (with error info) so we can skip them next time.
   */
  failedFiles: Array<{ file: string; reason: string }>;
}

/**
 * Create a StateManager for the given task. If saved state exists on disk
 * from a previous interrupted run, it is loaded automatically. Otherwise
 * fresh state is created from the provided file list.
 */
async function createLoopState(
  path: string,
  allFiles: Array<string>,
): Promise<LoopState> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as LoopState;
  } catch {
    return {
      allFiles,
      completedFiles: [],
      failedFiles: [],
    };
  }
}

/**
 * Persist the current state to disk
 */
async function saveLoopState(state: LoopState, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`);
}
