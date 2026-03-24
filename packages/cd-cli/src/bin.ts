#!/usr/bin/env node
import { runCli } from './cli.js';

try {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[cd-cli] ${message}`);
  process.exitCode = 1;
}
