/**
 * We ran a prompt through an Agent and it worked out okay
 */
export interface SuccessfulInvocationResult {
  readonly status: 'success';
  readonly output: string;
}

/**
 * We ran a prompt through an Agent and there was a transient problem which
 * indicates a problem with the agent rather than the prompt (for example
 * an 'out of tokens' error or a 'network down' error.).
 * Given a glitch the caller should probably stop and work out a configuration
 * which will work or wait until a transient problem is resolved
 */
export interface GlitchedInvocationResult {
  readonly status: 'glitch';
  readonly reason: string;
}

/**
 * We ran a prompt through and an Agent and it broke in a way that indicates
 * a problem with the prompt rather than the agent. This prompt should probably
 * not be tried again.
 */
export interface ErrorInvocationResult {
  readonly status: 'error';
  readonly reason: string;
}

/**
 * The outcome of invoking the agent on a single file
 */
export type InvokeResult =
  | SuccessfulInvocationResult
  | GlitchedInvocationResult
  | ErrorInvocationResult;
