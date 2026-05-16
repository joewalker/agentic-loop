import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { BugzillaTask } from '../prompt-generators/bugzilla.js';
import type { GitHubTask } from '../prompt-generators/github.js';
import type { PerFileTask } from '../prompt-generators/per-file.js';
import type { LoopCliConfig } from '../types.js';
import { expandIncludes } from './expand-prompt.js';

/**
 * These are the properties that parseArgs understands
 */
export interface ParsedArgs {
  readonly configPath: string;
  readonly verbose?: boolean | undefined;
  readonly maxPrompts?: number | undefined;
}

/**
 * Simple `process.argv.slice(2)` parsing to turn an array of strings into
 * a ParsedArgs object which describes how to act
 */
export function parseArgs(args: ReadonlyArray<string>): ParsedArgs {
  const verbose = args.includes('--verbose');
  const positional: Array<string> = [];
  let maxPrompts: number | undefined;

  for (const arg of args) {
    if (arg === '--verbose') {
      continue;
    }
    const match = arg.match(/^--(\w+)=(.+)$/u); // eslint-disable-line @typescript-eslint/prefer-regexp-exec
    if (match) {
      const [, key, value] = match;
      if (key === 'maxPrompts') {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0) {
          throw new Error(`Invalid --maxPrompts value: ${value}`);
        }
        maxPrompts = n;
      } else {
        throw new Error(`Unknown option: --${key}`);
      }
    } else {
      positional.push(arg);
    }
  }

  const configPath = positional[0];
  if (!configPath) {
    throw new Error(
      'Usage: loop-the-loop [--verbose] [--maxPrompts=N] <config.json>',
    );
  }

  return {
    configPath,
    verbose,
    maxPrompts,
  };
}

/**
 * Load a CLI JSON config file and normalize paths that should be interpreted
 * relative to the config file itself.
 */
export async function loadCliConfig(
  parsedArgs: ParsedArgs,
): Promise<LoopCliConfig> {
  const { configPath, maxPrompts, verbose } = parsedArgs;
  const resolvedPath = resolve(configPath);
  const raw = await readFile(resolvedPath, 'utf-8');

  let config: LoopCliConfig;
  try {
    config = JSON.parse(raw) as LoopCliConfig;
  } catch {
    throw new Error(`Failed to parse config file: ${resolvedPath}`);
  }

  return {
    ...(await normalizeCliConfig(config, resolvedPath)),
    ...(maxPrompts !== undefined ? { maxPrompts } : {}),
    ...(verbose ? { logger: 'verbose' as const } : {}),
  };
}

/**
 * Normalize a parsed CLI config so includes in JSON-defined prompt templates
 * and system prompts are resolved relative to the config file directory.
 */
export async function normalizeCliConfig(
  config: LoopCliConfig,
  configPath: string,
): Promise<LoopCliConfig> {
  const resolvedPath = resolve(configPath);
  const configDir = dirname(resolvedPath);

  return {
    ...config,
    ...(config.outputDir === undefined ? { outputDir: configDir } : {}),
    ...(config.systemPrompt !== undefined
      ? {
          systemPrompt: await expandIncludes(config.systemPrompt, configDir),
        }
      : {}),
    promptGenerator: normalizePromptGenerator(
      config.promptGenerator,
      configDir,
    ),
  };
}

/**
 * Normalize prompt-generator config values that need CLI-specific path or type
 * conversions.
 */
function normalizePromptGenerator(
  promptGenerator: LoopCliConfig['promptGenerator'],
  configDir: string,
): LoopCliConfig['promptGenerator'] {
  if (!Array.isArray(promptGenerator)) {
    return promptGenerator;
  }

  const [type, config] = promptGenerator;

  if (type === 'per-file' && isPerFileTaskConfig(config)) {
    return [
      type,
      {
        ...config,
        basePath: normalizeBasePath(config.basePath, configDir),
      },
    ];
  }

  if (type === 'bugzilla') {
    return [type, normalizeBugzillaTaskConfig(config, configDir)];
  }

  if (type === 'github') {
    return [type, normalizeGitHubTaskConfig(config, configDir)];
  }

  return promptGenerator;
}

/**
 * Normalize Bugzilla task config values loaded from JSON.
 */
function normalizeBugzillaTaskConfig(
  config: unknown,
  configDir: string,
): BugzillaTask {
  assertBugzillaTaskConfig(config);

  return {
    ...config,
    basePath: normalizeBasePath(config.basePath, configDir),
    search: normalizeBugzillaSearchParams(config.search),
  };
}

/**
 * Normalize GitHub task config values loaded from JSON.
 */
function normalizeGitHubTaskConfig(
  config: unknown,
  configDir: string,
): GitHubTask {
  assertGitHubTaskConfig(config);

  return {
    ...config,
    basePath: normalizeBasePath(config.basePath, configDir),
  };
}

/**
 * Normalize Bugzilla search parameters loaded from JSON.
 */
function normalizeBugzillaSearchParams(
  search: BugzillaTask['search'],
): BugzillaTask['search'] {
  if (search.change === undefined) {
    return search;
  }

  return {
    ...search,
    change: {
      ...search.change,
      from: parseDateField(search.change.from, 'search.change.from'),
      to: parseDateField(search.change.to, 'search.change.to'),
    },
  };
}

/**
 * Parse a JSON date field as a UTC yyyy-MM-dd date.
 */
function parseDateField(value: unknown, field: string): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a yyyy-MM-dd date string`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) {
    throw new Error(
      `${field} must be a valid yyyy-MM-dd date string: ${value}`,
    );
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      `${field} must be a valid yyyy-MM-dd date string: ${value}`,
    );
  }

  return date;
}

/**
 * Resolve a possibly relative base path against the config file directory.
 */
function normalizeBasePath(
  basePath: string | undefined,
  configDir: string,
): string {
  if (basePath === undefined) {
    return configDir;
  }

  return isAbsolute(basePath) ? basePath : resolve(configDir, basePath);
}

/**
 * Check whether an unknown value has the shape of a per-file task config.
 */
function isPerFileTaskConfig(value: unknown): value is PerFileTask {
  return (
    typeof value === 'object' &&
    value !== null &&
    'filePattern' in value &&
    typeof value.filePattern === 'string' &&
    'promptTemplate' in value &&
    typeof value.promptTemplate === 'string' &&
    (!('basePath' in value) || typeof value.basePath === 'string')
  );
}

/**
 * Check whether an unknown value is a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Assert that an unknown value has the runtime shape required for a Bugzilla
 * task config.
 */
function assertBugzillaTaskConfig(
  value: unknown,
): asserts value is BugzillaTask {
  if (!isRecord(value)) {
    throw new Error('bugzilla task config must be an object');
  }

  if (
    !('promptTemplate' in value) ||
    typeof value['promptTemplate'] !== 'string'
  ) {
    throw new Error('bugzilla.promptTemplate must be a string');
  }

  if ('basePath' in value && typeof value['basePath'] !== 'string') {
    throw new Error('bugzilla.basePath must be a string');
  }

  const search = value['search'];
  if (!isRecord(search)) {
    throw new Error('bugzilla.search must be an object');
  }

  assertBugzillaSearchParams(search);
}

/**
 * Assert that Bugzilla search params loaded from config use the expected
 * runtime field shapes.
 */
function assertBugzillaSearchParams(search: Record<string, unknown>): void {
  assertKnownProperties(
    search,
    // Keep this list in sync with SearchParams in bugzilla-types.ts and the
    // bugzillaSearchParams schema definition.
    [
      'advanced',
      'assignedTo',
      'bugFields',
      'bugSeverity',
      'bugStatus',
      'change',
      'components',
      'dryRun',
      'keywords',
      'logQuery',
      'product',
    ],
    'bugzilla.search',
  );

  assertOptionalBoolean(search, 'dryRun', 'bugzilla.search.dryRun');
  assertOptionalBoolean(search, 'logQuery', 'bugzilla.search.logQuery');
  assertOptionalString(search, 'product', 'bugzilla.search.product');
  assertOptionalString(search, 'assignedTo', 'bugzilla.search.assignedTo');
  assertOptionalStringArray(search, 'components', 'bugzilla.search.components');
  assertOptionalStringArray(search, 'bugStatus', 'bugzilla.search.bugStatus');
  assertOptionalStringArray(search, 'keywords', 'bugzilla.search.keywords');
  assertOptionalStringArray(
    search,
    'bugSeverity',
    'bugzilla.search.bugSeverity',
  );
  assertOptionalStringArray(search, 'bugFields', 'bugzilla.search.bugFields');

  if ('advanced' in search) {
    assertBugzillaAdvancedClauses(search['advanced']);
  }

  if ('change' in search) {
    assertBugzillaChangeClause(search['change']);
  }
}

/**
 * Assert that a Bugzilla advanced search value is an array of valid clauses.
 */
function assertBugzillaAdvancedClauses(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error('bugzilla.search.advanced must be an array');
  }

  value.forEach((clause, index) => {
    const prefix = `bugzilla.search.advanced[${index}]`;
    if (!isRecord(clause)) {
      throw new Error(`${prefix} must be an object`);
    }

    assertKnownProperties(clause, ['field', 'matchType', 'value'], prefix);
    assertRequiredString(clause, 'field', `${prefix}.field`);
    assertRequiredString(clause, 'matchType', `${prefix}.matchType`);
    assertRequiredString(clause, 'value', `${prefix}.value`);
  });
}

/**
 * Assert that a Bugzilla change search value is a valid clause.
 */
function assertBugzillaChangeClause(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('bugzilla.search.change must be an object');
  }

  assertKnownProperties(
    value,
    ['field', 'from', 'to', 'value'],
    'bugzilla.search.change',
  );
  assertRequiredString(value, 'field', 'bugzilla.search.change.field');
  assertRequiredDateField(value, 'from', 'bugzilla.search.change.from');
  assertRequiredDateField(value, 'to', 'bugzilla.search.change.to');
  assertRequiredString(value, 'value', 'bugzilla.search.change.value');
}

/**
 * Assert that an object contains only known properties.
 */
function assertKnownProperties(
  value: Record<string, unknown>,
  knownProperties: ReadonlyArray<string>,
  prefix: string,
): void {
  for (const key of Object.keys(value)) {
    if (!knownProperties.includes(key)) {
      throw new Error(`${prefix}.${key} is not supported`);
    }
  }
}

/**
 * Assert that an optional object property is a boolean.
 */
function assertOptionalBoolean(
  value: Record<string, unknown>,
  key: string,
  field: string,
): void {
  if (key in value && typeof value[key] !== 'boolean') {
    throw new Error(`${field} must be a boolean`);
  }
}

/**
 * Assert that an optional object property is a string.
 */
function assertOptionalString(
  value: Record<string, unknown>,
  key: string,
  field: string,
): void {
  if (key in value && typeof value[key] !== 'string') {
    throw new Error(`${field} must be a string`);
  }
}

/**
 * Assert that an object property is a required string.
 */
function assertRequiredString(
  value: Record<string, unknown>,
  key: string,
  field: string,
): void {
  if (!(key in value) || typeof value[key] !== 'string') {
    throw new Error(`${field} must be a string`);
  }
}

/**
 * Assert that an optional object property is an array of strings.
 */
function assertOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  field: string,
): void {
  if (!(key in value)) {
    return;
  }

  const array = value[key];
  if (!Array.isArray(array) || array.some(item => typeof item !== 'string')) {
    throw new Error(`${field} must be an array of strings`);
  }
}

/**
 * Assert that an object property is a Date or a string parseDateField can
 * validate later.
 */
function assertRequiredDateField(
  value: Record<string, unknown>,
  key: string,
  field: string,
): void {
  if (!(key in value)) {
    throw new Error(`${field} must be a yyyy-MM-dd date string`);
  }

  const fieldValue = value[key];
  if (!(fieldValue instanceof Date) && typeof fieldValue !== 'string') {
    throw new Error(`${field} must be a yyyy-MM-dd date string`);
  }
}

/**
 * Assert that an unknown value has the runtime shape required for a GitHub
 * task config.
 */
function assertGitHubTaskConfig(value: unknown): asserts value is GitHubTask {
  if (!isRecord(value)) {
    throw new Error('github task config must be an object');
  }

  if (
    !('promptTemplate' in value) ||
    typeof value['promptTemplate'] !== 'string'
  ) {
    throw new Error('github.promptTemplate must be a string');
  }

  if ('basePath' in value && typeof value['basePath'] !== 'string') {
    throw new Error('github.basePath must be a string');
  }

  const search = value['search'];
  if (!isRecord(search)) {
    throw new Error('github.search must be an object');
  }

  if (!('repository' in search) || typeof search['repository'] !== 'string') {
    throw new Error('github.search.repository must be a string');
  }

  if (!('query' in search) || typeof search['query'] !== 'string') {
    throw new Error('github.search.query must be a string');
  }
}
