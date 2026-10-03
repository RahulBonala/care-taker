# Care Taker: clickable demo

*Someone checks on them every day.*

A front-end-only, clickable mock of a follow-up service for patients going home
from hospital. An automated phone call asks about every dose; nothing is logged
until the patient confirms it. Family members get a daily report built only from
that log. Nurses handle flags, caregivers visit, doctors review, and the hospital
desk enrols patients at discharge.

**This is a demo with sample data.** There is no server, no real phone calls, no
real payments and no real patients. Everything lives in your browser's local
storage and can be reset at any time.

- Seven roles: Patient (phone call), Family, Nurse, Caregiver, Doctor, Hospital desk, Admin
- English, हिन्दी and తెలుగు for every screen and every call line (no English fallback)
- Works on phones from 320 px wide, tablets and desktops; light and dark; installable
- A 10-step guided story, split view, demo clock, activity feed and a clickable "How it works" map

The product name lives in one place: `src/config/brand.ts`.

## Run it

Needs Node.js 20.9 or newer.

```bash
cd care-taker
npm install
npm run dev            # http://localhost:3000
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Static export into `out/` (plain HTML, CSS and JS) |
| `npm run serve` | Serves `out/` on http://localhost:3000, like a static host would |
| `npm test` | Unit tests: call state machine, reply understanding, day simulation, translations |
| `npm run typecheck` | TypeScript, which also checks every language file has every key |
| `npm run lint` | ESLint |
| `npm run check:screens` | With `npm run serve` running: opens every screen at 320, 360, 768, 1280 and 1920 px, light and dark, in all three languages, and fails on sideways scrolling, console warnings or errors, or untranslated keys. `SHOTS=dir` also saves screenshots. Uses Playwright's Chromium (`npx playwright install chromium` once, if you do not have one). |

## Put it online (free static hosting)

`npm run build` writes a static site to `care-taker/out/`. Any static host works.
The app is at the root of the site unless you set `NEXT_PUBLIC_BASE_PATH`.

**Netlify** — New site from Git → base directory `care-taker`, build command
`npm run build`, publish directory `care-taker/out`. Or drag the `out` folder
onto <https://app.netlify.com/drop>.

**Vercel** — Import the repository, set *Root Directory* to `care-taker`. It
detects Next.js; the static export needs no other settings.

**Cloudflare Pages** — Connect the repository → root directory `care-taker`,
build command `npm run build`, output directory `out`.

**GitHub Pages** — Pages serves a site under `/<repository-name>/`, so build with
that base path, then publish the `out` folder (for example with the
`actions/upload-pages-artifact` and `actions/deploy-pages` actions):

```bash
NEXT_PUBLIC_BASE_PATH=/<repository-name> npm run build
```

`out/.nojekyll` is included so the `_next` folder is served. GitHub Pages on a
private repository needs a paid GitHub plan; the other three hosts work with
private repositories on their free plans.

### Moving it to its own repository

The demo sits in the `care-taker/` folder of this repository. To give it a
repository of its own with its history:

```bash
git subtree split --prefix=care-taker -b care-taker-only
git push git@github.com:<owner>/care-taker.git care-taker-only:main
```

## 5-minute demo script

Open the site on a laptop (1280 px or wider shows the device frames, split
view and activity feed). Press **Reset demo** first if anyone has used it.

1. **Start (20 s).** On the welcome page press **Start the 10-step story**. Point
   out the yellow "sample data" banner, the role switcher, the demo clock
   ("Day X of 14") and the activity feed. The story bar at the top has **Next**,
   **Back** and **Do it for me**; the control to press next is outlined.
2. **Desk enrols Mrs Lakshmi Devi (40 s).** "Fill Mrs Lakshmi Devi's details",
   step through, tick consent, "Enrol patient". The printed handout shows the
   number that will call her.
3. **Nurse verifies the prescription (30 s).** "Fill from the summary", save,
   tick each medicine, "Verify and start calls". Say: *no call goes out until a
   nurse verifies the prescription.*
4. **Lunch call on her keypad phone (40 s).** The clock jumps to 1:30 pm and the
   phone rings. Answer, hear the call in Telugu, press **Later, 30 minutes**. On
   the right her son's view and the feed show the reschedule.
5. **"Taken" (30 s).** The phone rings again. **Taken** → the call reads it back
   → **Yes** (or key 1). Only now is the dose logged.
6. **Her son in New Jersey (40 s).** 8 pm: Ravi sees the day in both time zones.
   Open today's report (the WhatsApp message) and tap a line to show the log
   entries it came from.
7. **"Not feeling well" (40 s).** Next morning. The call only says a nurse will
   call. The nurse (right) sees the urgent flag, calls, writes the outcome and
   closes it; the family sees "The nurse spoke to your mother".
8. **Caregiver visit (30 s).** Check in, record vitals, count pills. Matching
   counts turn her doses into caregiver-confirmed doses.
9. **Doctor review and renewal (30 s).** Dr Anjali Rao sees doses, flags and the
   vitals trend and sets the review date. Day 14: the family renews or picks the
   monthly plan.
10. **Admin (20 s).** Today's numbers and the audit trail of everything above.

If there is time left:

- Switch the language to **हिन्दी** or **తెలుగు** in the control bar: every
  screen, report and call line changes, including the tab title.
- **Admin → Demo** has a button for each edge case (no answer 3 times, a third
  postponement, unclear replies, someone else answers, refusal, missed dose at
  end of day, prescription not verified, consent withdrawn, report check fails,
  pill count mismatch, caregiver no-show, payment fails, package expires, family
  abroad, language switch, offline). Each one sets up the situation and opens the
  screen that shows it.
- **How it works** has two clickable diagrams (the patient journey and every
  branch of the call); each box opens the screen where it happens.
- Use the **Phone / Tablet / Desktop** buttons to show the same screen at each size.

## How it is built

- Next.js (App Router) with TypeScript and Tailwind CSS, exported as a static site.
- `src/config/brand.ts` — product name and tagline.
- `src/call-engine/` — the phone call as a pure state machine (with tests): read-back
  before logging, retries, postponements, "not feeling well", refusals, someone
  else answering, unclear replies and the keypad fallback.
- `src/domain/` — types and rules (schedule, dose status, visits, reports, packages).
- `src/sim/` — the demo clock: moving time places calls, runs visits, sends 8 pm
  reports and closes the day. Sample patients behave the same way every time.
- `src/store/` — one typed store, saved to local storage, with **Reset demo**.
  Story mode and the edge-case buttons live here too.
- `src/data/` — repository interfaces with an in-memory implementation that also
  applies role scoping (for example, the desk never sees medicines). A real
  backend would replace this folder.
- `src/i18n/` — one file per language. To add a language, copy `en.ts`, translate
  it (the type checker lists anything missing) and add one line in `index.ts`.
- `src/components/` — shell, shared pieces and one folder per role;
  routes are in `src/app/(roles)/<role>/`.

`MOCK_PLAN.md` lists every screen per role and the decisions made while building.
