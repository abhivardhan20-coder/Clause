import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const text =
  "Payment is due within 30 days.\n\nTermination requires written notice.";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/legal", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { available: true, provider: "Google Gemini" },
      });
    const data = route.request().postDataJSON();
    if (data.action === "question")
      return route.fulfill({
        json: { answer: "Payment is due within 30 days.", ids: [1] },
      });
    return route.fulfill({
      json: {
        title: data.title,
        mode: "ai",
        summary: "Payment and notice terms.",
        checklist: ["Clarify the notice period."],
        clauses: data.text
          .split("\n\n")
          .map((source: string, index: number) => ({
            id: index + 1,
            text: source,
            title: "Source " + (index + 1),
            explanation: index === 0 ? "Payment is due in 30 days." : "",
            attention: "info",
            question: index === 0 ? "When is the invoice sent?" : "",
          })),
      },
    });
  });
});
test("sample answers link to original wording", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Ask about this agreement" })
    .fill("When will I get paid?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("log")).toContainText("30");
  await page
    .getByRole("log")
    .getByRole("button", { name: "Clause 2", exact: true })
    .click();
  await expect(page.locator(".clause-detail blockquote")).toContainText(
    "thirty",
  );
});
test("comparison identifies edits and invalidates stale output", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Compare versions" }).click();
  await page.getByRole("button", { name: "Try example changes" }).click();
  await page
    .getByRole("button", { name: "Compare versions", exact: true })
    .click();
  await expect(page.locator(".diff-line.added").first()).toBeVisible();
  await expect(page.locator(".diff-line.removed").first()).toBeVisible();
  await page.getByLabel("Revised version").fill("Different text.");
  await expect(page.locator(".diff-result")).toHaveCount(0);
});
test("consent, coverage, bounded answer cache and session removal", async ({
  page,
}) => {
  let questions = 0;
  page.on("request", (r) => {
    if (
      r.url().endsWith("/api/legal") &&
      r.method() === "POST" &&
      r.postDataJSON()?.action === "question"
    )
      questions++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await page.getByLabel("Document name", { exact: true }).fill("My agreement");
  await page.getByLabel("Document text", { exact: true }).fill(text);
  await expect(
    page.getByRole("button", { name: "Analyze document" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Analyze document" }).click();
  await expect(
    page.getByRole("heading", { name: "My agreement", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".coverage-note").first()).toContainText("1 of 2");
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("textbox", { name: "Ask about this agreement" })
      .fill("When is payment due?");
    await page.getByRole("button", { name: "Send question" }).click();
    await expect(page.getByRole("log").locator(".assistant")).toHaveCount(
      i + 1,
    );
  }
  expect(questions).toBe(1);
  await page.getByRole("button", { name: "Clear conversation" }).click();
  await expect(page.getByRole("log")).toHaveCount(0);
  await page.getByRole("button", { name: "Remove document" }).click();
  await expect(
    page.getByRole("heading", { name: "My agreement", exact: true }),
  ).toHaveCount(0);
});
test("pasted markup is rendered as text and read-only import sends nothing", async ({
  page,
}) => {
  let posts = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/legal") && r.method() === "POST") posts++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await page
    .getByLabel("Document name", { exact: true })
    .fill("Untrusted text");
  await page
    .getByLabel("Document text", { exact: true })
    .fill('<img src=x onerror="window.compromised=true">');
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await page.getByRole("button", { name: "Read source excerpts" }).click();
  await expect(page.locator("blockquote")).toContainText("<img");
  expect(await page.evaluate(() => Object.hasOwn(window, "compromised"))).toBe(
    false,
  );
  expect(posts).toBe(0);
});
test("keyboard skip link and accessibility scans", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to document workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const overview = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    overview.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const dialog = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    dialog.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("mobile layout and reduced motion remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "New document", exact: true }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
test("production response has a fresh CSP nonce on every render", async ({
  page,
}) => {
  const first = await page.goto("/");
  const a = first?.headers()["content-security-policy"] ?? "";
  expect(a).toContain("frame-ancestors 'none'");
  expect(a).toContain("'nonce-");
  const nonce = a.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const inline = await page
    .locator("script:not([src])")
    .evaluateAll((scripts) =>
      scripts.filter((s) => s.textContent?.trim()).map((s) => s.nonce),
    );
  expect(inline.length).toBeGreaterThan(0);
  expect(inline.every((n) => n === nonce)).toBe(true);
  const second = await page.reload();
  expect(second?.headers()["content-security-policy"]).not.toBe(a);
});

test("checklist notes export with provenance and clear on refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Next steps" }).click();
  await page.getByRole("checkbox").first().check();
  await page
    .getByLabel("Your questions & context")
    .fill("Discuss the invoice date.");
  await page.getByRole("button", { name: "Export preparation brief" }).click();
  await expect(
    page.getByRole("textbox", { name: "Preparation brief" }),
  ).toHaveValue(/Discuss the invoice date/);
  await expect(
    page.getByRole("textbox", { name: "Preparation brief" }),
  ).toHaveValue(/ILLUSTRATIVE SAMPLE/);
  await expect(
    page.getByRole("textbox", { name: "Preparation brief" }),
  ).toHaveValue(/\[x\]/);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/-brief\.txt$/);
  expect(await download.failure()).toBeNull();
  const fs = await import("node:fs/promises");
  const output = await fs.readFile((await download.path())!, "utf8");
  expect(output).toContain("FULL ORIGINAL DOCUMENT");
  expect(output).toContain("Discuss the invoice date.");
  await page.reload();
  await page.getByRole("tab", { name: "Next steps" }).click();
  await expect(page.getByLabel("Your questions & context")).toHaveValue("");
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
});

test("200 percent text size preserves import controls without page overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  expect(
    await page.evaluate(() =>
      parseFloat(getComputedStyle(document.body).fontSize),
    ),
  ).toBeGreaterThanOrEqual(32);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await page
    .getByLabel("Document name", { exact: true })
    .fill("Large-text document");
  await page
    .getByLabel("Document text", { exact: true })
    .fill("Read this agreement.");
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Large-text document", exact: true }),
  ).toBeVisible();
});
