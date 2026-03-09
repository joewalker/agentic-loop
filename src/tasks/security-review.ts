import type { PerFileAgenticTask } from '../prompt-generators/per-file.js';

export const securityReviewTask: PerFileAgenticTask = {
  name: 'security-review',

  filePattern: 'server/http/src/**/*.ts',
  excludePatterns: ['**/__test__/**', '**/*.test.ts'],

  promptTemplate: `Review the file {{file}} for security vulnerabilities.

Focus on:
- Input validation and sanitization
- Authentication and authorization checks
- Injection risks (SQL, command, path traversal)
- Sensitive data exposure
- Error handling that might leak information

Output your findings as a markdown section with the file name as a heading.
If you find no issues, say so briefly.`,
};
