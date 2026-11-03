import { test, expect } from "@playwright/test";
test("generate, interact, follow up and restore", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Binary search/ }).click();
  await expect(
    page.getByRole("heading", { name: "Binary search laboratory" }),
  ).toBeVisible();
  await page.getByLabel("Target", { exact: true }).fill("999");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByLabel("Keep exploring")
    .fill("What happens when the target doesn't exist?");
  await page.getByRole("button", { name: "Build lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "When the target is absent" }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /When the target is absent/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "When the target is absent" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/learning-lab.png",
    fullPage: true,
  });
});

test("switch topics, compare JOINs, change learning rate and use mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: /SQL JOINs/ }).click();
  await page.getByRole("button", { name: "LEFT JOIN", exact: true }).click();
  await expect(page.getByText("NULL", { exact: true })).toBeVisible();
  await page.getByLabel("Keep exploring").fill("Show me gradient descent");
  await page.getByRole("button", { name: "Build lesson" }).click();
  await expect(
    page.getByRole("heading", { name: "Optimization laboratory" }),
  ).toBeVisible();
  await page.getByRole("slider").fill("1.1");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/Diverging: each step/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/mobile-gradient.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Explain this more simply" }).click();
  await expect(page.getByText(/Imagine a ball on a bowl/)).toBeVisible();
});

test("transformer questions render an interactive attention diagram", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page
    .getByLabel("What would you like to understand?")
    .fill(
      "Explain transformer attention with the sentence: The animal didn't cross the street because it was tired",
    );
  await page.getByRole("button", { name: "Build lesson" }).click();
  await expect(
    page.getByRole("button", { name: /animal/i }).first(),
  ).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("group", { name: /Interactive concept map/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /animal/i })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /animal/i }).first(),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".diagram-links li").first()).toBeVisible();
  await expect(page.getByText(/illustrative/i).first()).toBeVisible();
});
