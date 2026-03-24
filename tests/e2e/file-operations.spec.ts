import path from "node:path";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const credentials = {
  password: "demo123456",
};

const runtimePaths = {
  screenshotsDir: path.join(process.cwd(), "output", "playwright"),
};

function sanitizeTestId(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "root"
  );
}

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

test("create, rename, move, and delete folder", async ({ page }) => {
  const seed = Date.now();
  const createdName = `playwright-crud-${seed}`;
  const renamedName = `playwright-crud-renamed-${seed}`;
  const createdRowId = `explorer-row-${sanitizeTestId(createdName)}`;
  const renamedRowId = `explorer-row-${sanitizeTestId(renamedName)}`;
  const movedRowId = `explorer-row-${sanitizeTestId(`contracts/${renamedName}`)}`;

  await loginToExplorer(page);

  await page.getByTestId("tree-action-new-folder").click();
  await expect(page.getByTestId("dialog-create-folder")).toBeVisible();
  await page.getByTestId("dialog-create-folder-name").fill(createdName);
  await page.getByTestId("dialog-create-folder-submit").click();
  await expect(page.getByTestId(createdRowId)).toBeVisible();

  await page.getByTestId(createdRowId).click({ button: "right" });
  await page.getByTestId("context-action-rename").click({ force: true });
  await expect(page.getByTestId("dialog-rename")).toBeVisible();
  await page.getByTestId("dialog-rename-name").fill(renamedName);
  await page.getByTestId("dialog-rename-submit").click();
  await expect(page.getByTestId(renamedRowId)).toBeVisible();
  await expect(page.getByTestId(createdRowId)).toHaveCount(0);
  await expect(page.getByTestId("dialog-rename")).toHaveCount(0);

  await page.evaluate(
    async ({ sourcePath, targetDirPath }) => {
      const response = await fetch("/api/files/move", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          rootId: "docs",
          sourcePath,
          targetDirPath,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    {
      sourcePath: renamedName,
      targetDirPath: "contracts",
    },
  );
  await page.getByTestId("explorer-refresh").click();
  await expect(page.getByTestId(renamedRowId)).toHaveCount(0);

  await page.getByTestId("explorer-row-contracts").click();
  await expect(page.getByTestId(movedRowId)).toBeVisible();
  await capture(page, "08-crud-ready-to-delete.png");

  await page.getByTestId(movedRowId).click({ button: "right" });
  await expect(page.getByTestId("explorer-context-menu")).toBeVisible();
  await page.getByTestId("context-action-delete").click({ force: true });
  await expect(page.getByTestId("dialog-delete")).toBeVisible();
  await page.getByTestId("dialog-delete-submit").click();
  await expect(page.getByTestId(movedRowId)).toHaveCount(0);
  await capture(page, "09-crud-completed.png");
});
