import { reactReviewTask } from 'agentic-loop/tasks/react-review';
import { securityReviewTask } from 'agentic-loop/tasks/security-review';
import { describe, expect, it } from 'vitest';

describe('reactReviewTask', () => {
  it('should have the correct name', () => {
    expect(reactReviewTask.name).toBe('react-review');
  });

  it('should target .tsx files in web/backdrop/src/', () => {
    expect(reactReviewTask.filePattern).toBe('web/backdrop/src/**/*.tsx');
  });

  it('should exclude test directories', () => {
    expect(reactReviewTask.excludePatterns).toContain('**/__test__/**');
  });

  it('should have a prompt template with {{file}} placeholder', () => {
    expect(reactReviewTask.promptTemplate).toContain('{{file}}');
  });
});

describe('securityReviewTask', () => {
  it('should have the correct name', () => {
    expect(securityReviewTask.name).toBe('security-review');
  });

  it('should target .ts files in server/http/src/', () => {
    expect(securityReviewTask.filePattern).toBe('server/http/src/**/*.ts');
  });

  it('should exclude test directories and test files', () => {
    expect(securityReviewTask.excludePatterns).toContain('**/__test__/**');
    expect(securityReviewTask.excludePatterns).toContain('**/*.test.ts');
  });

  it('should have a prompt template with {{file}} placeholder', () => {
    expect(securityReviewTask.promptTemplate).toContain('{{file}}');
  });
});
