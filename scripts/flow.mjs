// Drive the app through a list of steps and take screenshots.
// Usage: node scripts/flow.mjs <steps.json>
// Steps: {"goto": "/patient/"} | {"click": "text or css", "nth": 0} | {"wait": ms} | {"shot": "name"} | {"eval": "js"} | {"fill": "css", "value": "x"} | {"size": [w,h]}
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const steps = JSON.parse(readFileSync(process.argv[2], "utf8"));
const base = process.env.BASE || "http://localhost:3100";
const outDir = process.env.OUT || "/tmp/claude-0/shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => ["warning", "error"].includes(m.type()) && !m.text().includes("404") && logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
for (const s of steps) {
  try {
    if (s.size) await page.setViewportSize({ width: s.size[0], height: s.size[1] });
    if (s.goto) {
      await page.goto(base + s.goto, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
    }
    if (s.click) {
      const loc = s.click.startsWith("css:") ? page.locator(s.click.slice(4)) : page.getByRole(s.role || "button", { name: s.click, exact: !!s.exact });
      await loc.nth(s.nth || 0).click({ timeout: 5000, force: !!s.force });
      await page.waitForTimeout(s.after ?? 400);
    }
    if (s.text) {
      await page.getByText(s.text, { exact: !!s.exact }).nth(s.nth || 0).click({ timeout: 5000 });
      await page.waitForTimeout(s.after ?? 400);
    }
    if (s.fill) await page.locator(s.fill).fill(s.value);
    if (s.press) await page.keyboard.press(s.press);
    if (s.eval) console.log("eval:", JSON.stringify(await page.evaluate(s.eval)));
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) await page.screenshot({ path: `${outDir}/${s.shot}.png`, fullPage: !!s.full });
  } catch (e) {
    console.log("STEP FAILED", JSON.stringify(s), e.message.split("\n")[0]);
  }
}
console.log(logs.length ? logs.join("\n") : "no console warnings");
await browser.close();
