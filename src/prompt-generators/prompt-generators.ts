import { reactReviewTask } from '../tasks/react-review.js';
import { securityReviewTask } from '../tasks/security-review.js';
import type { InvokeResult } from '../types.js';
import { PerFilePromptGenerator } from './per-file.js';

/**
 * A prompt is basically just a string that we pass to an agent to kick off
 * some work. In addition to the prompt string, we also track an id for
 * debugging purposes and a function to inform the PromptGenerator what
 * happened when we executed the prompt.
 */
export interface Prompt {
  /**
   * Unique identifier which could be useful in debugging to quickly identify
   * a prompt that is causing problems. Likely to be a bug-id, filename, index
   * into an array, etc.
   * Typically we won't be able to use the prompt as an identifier due to its
   * length and the likelihood that the unique part will be embedded deep in
   * the prompt
   */
  readonly id: string;

  /**
   * The initial text to send to the agent
   */
  readonly prompt: string;

  /**
   * Many PromptGenerators will mark the thing they are iterating over to say
   * that it is being worked on. This allows us to report that the work is
   * complete, maybe the bug should be closed, maybe the failure was a glitch
   * and so the prompt should be retried, etc.
   */
  recordResult(result: InvokeResult): Promise<void>;
}

/**
 * A PromptGenerator is (obviously) a source of Prompts
 *
 */
export interface PromptGenerator extends AsyncIterable<Prompt> {
  readonly name: string;
}

export const DEFAULT_PROMPT_GENERATOR = 'default';

/**
 * To add a new PromptGenerator, add its creator function here
 */
const creatorFunctions = {
  ['per-file-react']: () => new PerFilePromptGenerator(reactReviewTask),
  ['per-file-security']: () => new PerFilePromptGenerator(securityReviewTask),
  [DEFAULT_PROMPT_GENERATOR]: () => new PerFilePromptGenerator(reactReviewTask),
} satisfies Record<string, () => PromptGenerator>;

/**
 * Enable TypeScript to know what prompt generators are available
 */
export type PromptGeneratorType = keyof typeof creatorFunctions;

/**
 * Enable the command line to know what prompt generators are available
 */
export const promptGeneratorTypes = Object.keys(creatorFunctions);

/**
 * Allow easy switching between different PromptGenerator types
 */
export function createPromptGenerator(
  type: PromptGeneratorType = DEFAULT_PROMPT_GENERATOR,
): PromptGenerator {
  return creatorFunctions[type]();
}
