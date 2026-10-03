// Opens every screen of the static build at several widths, in light and dark,
// and in each language, and reports horizontal overflow, console warnings or
// errors, and text that looks like an untranslated key or placeholder.
//
// Usage: npm run build && (npm run serve &) && npm run check:screens
// Env: BASE (default http://localhost:3000), SHOTS=<dir> to save screenshots,
//      CHROMIUM=<path> to use a specific Chromium, QUICK=1 for fewer widths.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE || `http://localhost:3000${process.env.NEXT_PUBLIC_BASE_PATH || ""}`).replace(/\/$/, "");
const SHOTS = process.env.SHOTS;
const CHROMIUM = process.env.CHROMIUM || (existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const STORE_KEY = "care-taker-demo";

const ALL_WIDTHS = process.env.QUICK ? [360, 1280] : [320, 360, 768, 1280, 1920];
const RUNS = [
  { scheme: "light", lang: "en", widths: ALL_WIDTHS },
  { scheme: "light", lang: "en", widths: [320], signedOut: true },
  { scheme: "dark", lang: "en", widths: [360, 1280] },
  { scheme: "light", lang: "hi", widths: [360, 1280] },
  { scheme: "dark", lang: "te", widths: [360, 1280] },
];

function routes() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === "_next" || name === "icons") continue;
        walk(p, `${prefix}${name}/`);
      } else if (name === "index.html") out.push(prefix);
    }
  };
  if (!existsSync("out")) {
    console.error("No ./out folder. Run `npm run build` first.");
    process.exit(1);
  }
  walk("out", "/");
  return out.sort();
}

/** Runs in the page: what sticks out past the viewport without a clipping or scrolling parent that fits. */
function measure() {
  const W = window.innerWidth;
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}` : ""}`;
  const overflow = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || r.right <= W + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.visibility === "hidden") continue;
    let a = el.parentElement;
    let held = false;
    while (a && a !== document.body) {
      if (getComputedStyle(a).overflowX !== "visible" && a.getBoundingClientRect().right <= W + 1) {
        held = true;
        break;
      }
      a = a.parentElement;
    }
    if (!held) overflow.push(`${name(el)} right=${Math.round(r.right)}`);
  }
  const scrollers = [];
  for (const el of document.body.querySelectorAll("*")) {
    const s = getComputedStyle(el).overflowX;
    if ((s === "auto" || s === "scroll") && el.scrollWidth > el.clientWidth + 1 && el.getBoundingClientRect().width > 0) scrollers.push(name(el));
  }
  const text = document.body.innerText;
  const rawKeys = [...new Set(text.match(/(?<![\w./@-])(?:[a-z]+\.){1,}[a-z][A-Za-z0-9_]+(?![\w/@-])/g) || [])].filter((s) => !/\.(com|in|org|net|html|js|png|svg)$/.test(s));
  const placeholders = [...new Set(text.match(/\{\w+\}/g) || [])];
  return { pageScroll: document.documentElement.scrollWidth > W + 1, overflow: overflow.slice(0, 4), scrollers: scrollers.slice(0, 4), rawKeys: rawKeys.slice(0, 4), placeholders };
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const list = routes();
const problems = [];
const notes = [];
let checked = 0;

for (const run of RUNS) {
  const ctx = await browser.newContext({ colorScheme: run.scheme, deviceScaleFactor: 1 });
  // After the first load seeds the store, every later load starts in this language with every family member signed in.
  await ctx.addInitScript(
    ([key, lang, signedOut]) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const j = JSON.parse(raw);
        if (j?.state?.ui) {
          j.state.ui.language = lang;
          j.state.ui.familySignedIn = Object.fromEntries((j.state.data?.family ?? []).map((f) => [f.id, !signedOut]));
          localStorage.setItem(key, JSON.stringify(j));
        }
      } catch {}
    },
    [STORE_KEY, run.lang, Boolean(run.signedOut)],
  );
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => ["warning", "error"].includes(m.type()) && logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  for (const width of run.widths) {
    await page.setViewportSize({ width, height: width < 640 ? 760 : width < 1024 ? 1000 : 900 });
    for (const route of list) {
      logs.length = 0;
      if (run.signedOut && !route.startsWith("/family/")) continue;
      const label = `${run.lang} ${run.scheme} ${width}px ${run.signedOut ? "signed out " : ""}${route}`;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(450);
        const m = await page.evaluate(measure);
        checked++;
        const issues = [];
        if (m.pageScroll) issues.push("page scrolls sideways");
        if (m.overflow.length) issues.push(`overflow: ${m.overflow.join(" | ")}`);
        if (m.rawKeys.length) issues.push(`raw keys: ${m.rawKeys.join(", ")}`);
        if (m.placeholders.length) issues.push(`placeholders: ${m.placeholders.join(", ")}`);
        if (logs.length) issues.push(...logs);
        if (issues.length) problems.push(`${label}\n    ${issues.join("\n    ")}`);
        if (m.scrollers.length) notes.push(`${label}: side-scrolling box ${m.scrollers.join(", ")}`);
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: join(SHOTS, `${run.lang}-${run.scheme}-${width}${route.replace(/\//g, "_")}.png`) });
        }
      } catch (e) {
        problems.push(`${label}\n    failed: ${e.message.split("\n")[0]}`);
      }
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`Checked ${checked} screen loads (${list.length} routes).`);
if (notes.length) console.log(`\nBoxes that scroll sideways inside the page (allowed, listed for review):\n  ${[...new Set(notes)].slice(0, 30).join("\n  ")}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("No problems found.");
