
# agentic-loop

A framework for running generated prompts through coding agents in an automated loop.

## Getting Started

```sh
pnpm install
pnpm test
```

`pnpm install` automatically builds the project. You can rebuild manually with `pnpm tsc`.

## Usage

```ts
import { createAgent, createPromptGenerator, main } from 'agentic-loop';

const agent = createAgent('claude-sdk');
const prompts = createPromptGenerator('per-file-react');

const result = await main(agent, prompts);
console.log(result);
```

Available agents: `claude-sdk`, `codex-cli`.

Available prompt generators: `per-file-react`, `per-file-security`.

Custom tasks can be built using `PerFilePromptGenerator` with a `PerFileAgenticTask` config.

## How it Works

The loop iterates over prompts from the generator, passes each to the agent, commits
successful results to git, and resumes from saved state if interrupted. Transient
failures (rate limits, network errors) are retried up to a limit; prompt-level errors
stop the loop immediately.
