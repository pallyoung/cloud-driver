import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function sanitizeTestId(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'root';
}

export async function runBrowserSmoke(options) {
  const baseUrl = options.baseUrl;
  const password = options.password;
  const rootId = options.rootId;
  const screenshotDir = options.screenshotDir;
  const headed = options.headed === 'true';

  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({
    viewport: {
      width: 1600,
      height: 1200,
    },
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('login-password').fill(password);
    await page.screenshot({ path: path.join(screenshotDir, 'cli-packaged-login.png'), fullPage: true });
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/explorer$/, { timeout: 30_000 });

    const rootTestId = `explorer-root-${sanitizeTestId(rootId)}`;
    await page.getByTestId(rootTestId).click();
    await page.getByTestId('tree-node-docs').click();
    await page.getByTestId('tree-node-docs-readme-md').click();
    await page.getByTestId('detail-mode-edit').waitFor({ timeout: 30_000 });

    await page.screenshot({ path: path.join(screenshotDir, 'cli-packaged-explorer.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const args = parseArgs(process.argv.slice(2));

  await runBrowserSmoke({
    baseUrl: args.baseUrl ?? 'http://127.0.0.1:3210',
    password: args.password ?? 'phase2-secret',
    rootId: args.rootId ?? 'dev-roots',
    screenshotDir: args.screenshotDir ?? path.join(repoRoot, 'output', 'playwright'),
    headed: args.headed ?? 'false',
  });
}
