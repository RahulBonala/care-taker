// Usage: node scripts/shot.mjs <url> <width> <height> <out.png> [--setup=js] [--wait=ms]
// Takes a screenshot with the preinstalled Chromium and prints console warnings/errors.
import { chromium } from "@playwright/test";

const [url, w, h, out, ...rest] = process.argv.slice(2);
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1, hasTouch: opts.touch === "1", colorScheme: opts.dark === "1" ? "dark" : "light" });
const logs = [];
page.on("console", (m) => {
  if (["warning", "error"].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "networkidle" });
if (opts.setup) {
  await page.evaluate(opts.setup);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(Number(opts.wait || 600));
const overflow = await page.evaluate(() => {
  const els = [...document.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed" && r.width > 0;
  });
  return { docW: document.documentElement.scrollWidth, winW: window.innerWidth, offenders: els.slice(0, 5).map((e) => e.tagName + "." + (e.className?.toString?.() ?? "").slice(0, 60)) };
});
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, overflow, logs }, null, 1));
await browser.close();
