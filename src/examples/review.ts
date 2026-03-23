import { loadEnvFile } from 'node:process';

import { agenticLoop } from 'agentic-loop';

loadEnvFile();

await agenticLoop({
  name: 'review',
  agent: 'codex-cli', // or 'claude-sdk'
  promptGenerator: [
    'per-file',
    {
      filePattern: 'src/**/*.ts',
      excludePatterns: ['**/__test__/**'],
      promptTemplate: '/review {{file}}',
    },
  ],
  maxPrompts: 5,
}).catch(console.error);
