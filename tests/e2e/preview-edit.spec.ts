import path from "node:path";
import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

const credentials = {
  password: "demo123456",
};

const runtimePaths = {
  screenshotsDir: path.join(process.cwd(), "output", "playwright"),
};

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

async function loginToExplorer(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-language-en").click();
  await page.getByTestId("login-password").fill(credentials.password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("explorer-search")).toBeVisible();
  await expect(page.getByTestId("explorer-row-readme-md")).toBeVisible();
}

test("preview workspace and keyboard save shortcut", async ({ page }) => {
  await loginToExplorer(page);

  await page.getByTestId("explorer-row-readme-md").click();
  const editor = page.getByTestId("editor-textarea");
  await expect(editor).toBeVisible();
  await expect(page.getByTestId("editor-wrap-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("editor-wrap-toggle")).toHaveAttribute(
    "aria-label",
    "Wrap On",
  );

  const currentContent = await readEditorContent(editor);
  const updatedContent = currentContent.includes(
    "Shortcut saved by Playwright.",
  )
    ? currentContent
    : `${currentContent.trimEnd()}\nShortcut saved by Playwright.\n`;

  await fillEditor(page, editor, updatedContent);
  await expect(editor).toContainText("Shortcut saved by Playwright.");
  await page.getByTestId("editor-wrap-toggle").click();
  await expect(page.getByTestId("editor-wrap-toggle")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("editor-wrap-toggle")).toHaveAttribute(
    "aria-label",
    "Wrap Off",
  );
  await page.getByTestId("detail-mode-preview").click();
  await expect(page.getByTestId("preview-text-viewer")).toContainText(
    "Shortcut saved by Playwright.",
  );
  await capture(page, "10-preview-text.png");

  await page.getByTestId("detail-mode-edit").click();
  await expect(editor).toContainText("Shortcut saved by Playwright.");
  await editor.click();
  await page.keyboard.press("Control+S");
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  await page.getByTestId("explorer-root-media").click();
  await expect(page.getByTestId("explorer-row-diagram-png")).toBeVisible();
  await page.getByTestId("explorer-row-diagram-png").click();
  await expect(page.getByTestId("preview-image")).toBeVisible();
  await page.getByTestId("preview-image-zoom-in").click();
  await expect(page.getByText("Scale 125%")).toBeVisible();
  await capture(page, "11-preview-image.png");
});
