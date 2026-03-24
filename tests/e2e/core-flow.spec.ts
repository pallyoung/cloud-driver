import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const credentials = {
  password: "demo123456",
};

const runtimePaths = {
  downloadsDir: path.join(process.cwd(), "tmp", "e2e-runtime", "downloads"),
  screenshotsDir: path.join(process.cwd(), "output", "playwright"),
};

test.describe.configure({ mode: "serial" });

async function capture(page: Page, name: string) {
  await mkdir(runtimePaths.screenshotsDir, { recursive: true });
  await page.screenshot({
    path: path.join(runtimePaths.screenshotsDir, name),
    fullPage: true,
  });
}

async function readEditorContent(editor: Locator): Promise<string> {
  return ((await editor.textContent()) ?? "").replace(/\u00a0/g, " ");
}

async function fillEditor(page: Page, editor: Locator, value: string) {
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(value);
}

async function waitForTaskStatus(
  page: Page,
  selector: string,
  expectedStatuses: string[],
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const card = page.locator(selector).first();

    if ((await card.count()) === 0) {
      await page.getByTestId("jobs-refresh").click();
      await page.waitForTimeout(500);
      continue;
    }

    const text = (await card.textContent()) ?? "";

    if (expectedStatuses.some((status) => text.includes(status))) {
      return card;
    }

    await page.getByTestId("jobs-refresh").click();
    await page.waitForTimeout(500);
  }

  throw new Error(
    `Timed out waiting for ${selector} to reach one of: ${expectedStatuses.join(", ")}`,
  );
}

test("single-user core flow", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByTestId("login-language-en").click();
  await page.getByTestId("login-password").fill(credentials.password);
  await capture(page, "01-login.png");

  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("explorer-search")).toBeVisible();
  await expect(page.getByTestId("explorer-row-readme-md")).toBeVisible();
  await capture(page, "02-explorer.png");

  await page.getByTestId("explorer-row-readme-md").click();
  const editor = page.getByTestId("editor-textarea");
  await expect(editor).toBeVisible();
  const currentContent = await readEditorContent(editor);
  const updatedContent = currentContent.includes("Reviewed by Playwright E2E.")
    ? currentContent
    : `${currentContent.trimEnd()}\nReviewed by Playwright E2E.\n`;
  await fillEditor(page, editor, updatedContent);
  await expect(editor).toContainText("Reviewed by Playwright E2E.");
  await expect(page.getByTestId("editor-save")).toBeEnabled();

  await page.getByTestId("explorer-breadcrumb-root").click();
  await expect(page.getByTestId("dialog-unsaved")).toBeVisible();
  await capture(page, "04-editor-unsaved.png");
  await page.getByTestId("dialog-unsaved-cancel").click();

  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-contracts").click({ button: "right" });
  await expect(page.getByTestId("explorer-context-menu")).toBeVisible();
  await page.getByTestId("context-action-export").click({ force: true });
  await expect(page.getByTestId("dialog-export")).toBeVisible();
  await page.getByTestId("dialog-export-submit").click();

  await expect(page).toHaveURL(/\/jobs$/);
  await waitForTaskStatus(page, '[data-testid^="job-export-"]', ["ready"]);
  await capture(page, "04-jobs-ready.png");

  await page
    .locator('[data-testid^="job-open-source-export-"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByTestId("explorer-row-contracts")).toBeVisible();
  await capture(page, "05-explorer-source-jump.png");
  await page.getByTestId("nav-jobs").click();
  await expect(page).toHaveURL(/\/jobs$/);

  const download = page.waitForEvent("download");
  await page.locator('[data-testid^="job-download-"]').first().click();
  const exportDownload = await download;
  const downloadTarget = path.join(
    runtimePaths.downloadsDir,
    exportDownload.suggestedFilename(),
  );
  await exportDownload.saveAs(downloadTarget);
  await access(downloadTarget);

  await waitForTaskStatus(page, '[data-testid^="job-export-"]', ["cleaned"]);
  await capture(page, "06-jobs-cleaned.png");

  await page.getByTestId("nav-settings").click();
  await expect(
    page.getByRole("heading", { name: "System Configuration" }),
  ).toBeVisible();
  await capture(page, "07-settings.png");
});
