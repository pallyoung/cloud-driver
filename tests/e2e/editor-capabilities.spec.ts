import path from "node:path";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

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

async function loginToExplorer(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-language-en").click();
  await page.getByTestId("login-password").fill(credentials.password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("explorer-search")).toBeVisible();
  await expect(page.getByTestId("explorer-row-readme-md")).toBeVisible();
}

test("editor language support, formatting, and large file guidance", async ({
  page,
}) => {
  await loginToExplorer(page);

  await page.getByTestId("explorer-row-config-json").click();
  await expect(page.getByTestId("editor-language")).toContainText("JSON");
  await expect(page.getByTestId("editor-line-ending")).toContainText("LF");
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format JSON",
  );
  await expect(page.getByTestId("editor-textarea")).toContainText(
    '"owner":"operations"',
  );
  await page.getByTestId("editor-format").click();
  await expect(page.getByTestId("editor-textarea")).toContainText(
    '"owner": "operations"',
  );
  await expect(page.getByTestId("editor-save")).toBeEnabled();
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-ops-yaml").click();
  await expect(page.getByTestId("editor-language")).toContainText("YAML");
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format YAML",
  );
  await page.getByTestId("editor-format").click();
  await expect(page.getByTestId("editor-textarea")).toContainText(
    "workers: [api, web]",
  );
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-module-ts").click();
  await expect(page.getByTestId("editor-language")).toContainText("TypeScript");
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format TypeScript",
  );
  await page.getByTestId("editor-format").click();
  await expect(page.getByTestId("editor-textarea")).toContainText(
    "export const renderUser = (name: string) => {",
  );
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-save")).toBeDisabled();

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-landing-html").click();
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format HTML",
  );

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-theme-css").click();
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format CSS",
  );

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-guide-md").click();
  await expect(page.getByTestId("editor-format")).toHaveAttribute(
    "aria-label",
    "Format Markdown",
  );

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-deploy-sh").click();
  await expect(page.getByTestId("editor-language")).toContainText("Shell");
  await expect(page.getByTestId("editor-format")).toHaveCount(0);

  await page.getByTestId("explorer-breadcrumb-root").click();
  await page.getByTestId("explorer-row-oversized-log").click();
  await expect(page.getByTestId("detail-mode-edit")).toBeDisabled();
  await expect(page.getByText("too large for browser editing")).toBeVisible();
  await capture(page, "12-editor-capabilities.png");
});
