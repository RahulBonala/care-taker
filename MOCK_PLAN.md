# Care Taker mock: build plan

A clickable, front-end-only demo. No backend, no network calls, sample data only.
The product name is never typed into screens; it comes from `src/config/brand.ts`.

## 1. Shape of the app

```
┌ Sample data banner (always) ─────────────────────────────────────────────┐
├ Demo control bar ─ role · acting as · language · device · clock · story ─┤
│                                                                          │
│   Stage: one pane, or two panes side by side (split view)                │
│   Each pane = one role, rendered inside a device frame when previewing   │   Activity
│   Each pane has its own nav: bottom tabs / side rail / sidebar           │   feed
│                                                                          │
└ Story panel (when story mode is on) ─────────────────────────────────────┘
```

* The shell (banner, control bar, feed, story panel) responds to the real
  viewport with media queries. Phone: controls collapse into one floating
  button that opens a sheet.
* Role screens respond to the width of their pane with container queries, so
  a pane inside a phone frame on a desktop really shows the phone layout, and
  split view panes adapt on their own.
* The left (or only) pane follows the URL (`/family/report`). The right pane in
  split view is driven by the store. Both render the same screen components
  from one registry.

## 2. Screens per role

| Role | Route | Screens |
|---|---|---|
| Patient (phone call) | `/patient`, `/patient/today` | Call simulator (keypad phone or smartphone, incoming call, answer/decline, transcript one line at a time, optional speech, reply buttons, keypad 1/2/3, free text, after-call result, today strip); "Today's medicines" large-button screen |
| Family | `/family`, `/family/report`, `/family/history`, `/family/visits`, `/family/settings`, `/family/package` | Sign-in with phone + OTP (once); home; daily report + WhatsApp preview with tap-to-source; report history + 14-day strip; visits; settings (call/meal times, add family member, report language, time zone); package and payment (pay, renew, monthly); request nurse call-back |
| Nurse | `/nurse`, `/nurse/patient`, `/nurse/flags`, `/nurse/flag`, `/nurse/visits` | Patient list with filters; patient detail (prescription entry against discharge summary, verify step, 3-day schedule preview, care plan, consent, log and nurse notes); flag queue by urgency; flag detail (transcript, call patient, outcome, close); visits and caregiver assignment |
| Caregiver | `/caregiver`, `/caregiver/visit`, `/caregiver/profile` | Today's visits; visit detail (check in, tasks, vitals with range checks, pill count, note, voice note, check out, "Patient unwell"); profile |
| Doctor | `/doctor`, `/doctor/patient`, `/doctor/weekly` | My patients with status chips and one-tap search; patient summary (adherence, missed doses, flags, vitals charts, meals mentioned, review date, request longer package); printable weekly report |
| Hospital desk | `/desk`, `/desk/today` | Enrolment (details, care, consent, discharge summary upload, confirmation + printable handout in the patient's language); today's enrolments |
| Admin | `/admin`, `/admin/accuracy`, `/admin/setup`, `/admin/audit`, `/admin/demo` | Overview numbers; call accuracy; users, organisations, packages and prices (editable), payments and refunds; audit trail; demo toggles for every edge case |
| Shared | `/`, `/how-it-works` | Welcome; flow map with the patient journey and the call flow as clickable SVG |

Every screen has finished empty, loading and error states (loading and error
can be forced from Admin → Demo to show them).

## 3. Store shape (`src/store/store.ts`, Zustand, persisted to localStorage)

```ts
{
  data: {                      // everything a real backend would own
    hospitals, staff, patients, family,
    calls,                     // finished and live call records (inputs only; transcript is replayed)
    queue,                     // scheduled calls waiting for their time
    log,                       // append-only clinical log; corrections replace, never edit
    flags, visits, reports, messages (WhatsApp), payments, packages,
    audit, events (activity feed), callbacks,
    phone: { ringing, activeCallId }
  },
  clock: { now },              // simulated time (ms)
  ui: {
    language, actingAs: { [role]: personId }, focusPatientId,
    device, orientation, split: { on, right: { role, screen } },
    feedOpen, highlight, selection: { patient, flag, visit, doctorPatient },
    familySignedIn, phoneStyle, speak, callLanguage,
    demo: { autoAnswerSkipped, autoVisits, paymentOutcome, slowNetwork, forceErrors, offline, ... }
  },
  story: { active, step }
}
```

All domain rules live in pure modules (`src/call-engine`, `src/domain`,
`src/sim`). Store actions call them and write the result back. Screens read
data only through the repository interfaces in `src/data`, which also apply
role scoping (the caregiver never receives payments or family phone numbers,
the desk never receives clinical logs, the doctor gets only their own patients,
a family member only their own patient).

## 4. Folder layout

```
src/
  config/brand.ts            APP_NAME, APP_TAGLINE (the only place the name lives)
  i18n/                      en.ts, hi.ts, te.ts, index.ts (registry), format.ts
  lib/                       time (IST helpers), ids, hash, cn
  domain/                    types, schedule, doses, reports, visits, packages
  call-engine/               pure call state machine + reply classifier + end-of-day, with tests
  sim/                       clock advance, background behaviour, seed data, scenarios, story steps
  data/                      repository interfaces + in-memory implementation + role scoping
  store/                     Zustand store and actions
  components/
    shell/                   control bar, sheet, panes, device frame, clock, feed, story panel
    ui/                      buttons, cards, chips, sheets, fields, states
    patient/ family/ nurse/ caregiver/ doctor/ desk/ admin/ charts/ flow/
  app/
    layout.tsx, page.tsx, how-it-works/
    (roles)/patient | family | nurse | caregiver | doctor | desk | admin
```

## 5. Build order

1. Demo shell and controls
2. Sample data and store
3. Call engine with tests
4. Patient simulator
5. Family
6. Nurse
7. Caregiver
8. Doctor
9. Hospital desk
10. Admin
11. Story mode
12. Flow map
13. Edge-case toggles
14. Polish, Hindi and Telugu completion, checks at 360, 768 and 1280 px

## 6. Interpretations made up front

* **Clock jumps.** Calls the clock passes over are answered automatically using
  each sample patient's scripted behaviour (mostly "taken"), so jumping to day 14
  produces a realistic history instead of a wall of "no answer" flags. A call
  that falls exactly on the new clock time for the patient on screen rings and
  waits for you. Admin → Demo can switch skipped calls to "not answered".
* **Story mode** starts from its own baseline in which Mrs Lakshmi Devi has not
  been enrolled yet; free exploration starts with her already on day 3.
* **Refusal** is kept as a note on the call record and on the nurse flag, not as a
  dose record, so that nothing about a dose enters the clinical log without
  read-back and confirmation.
* **Third postponement** opens the flag and the system stops calling for that dose;
  the nurse takes over.
* **Call times** default to 30 minutes after each meal time and bedtime itself;
  family and nurse can override each call time.
