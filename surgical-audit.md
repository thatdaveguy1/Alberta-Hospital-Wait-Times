# Surgical Data Audit — Power BI Scraper Output

Audits the surgery data scraped from the Alberta Health System Dashboard Power BI
report (`src/pipelines/powerbiScraper.ts`) as persisted to `data-surgical.json`
and rendered by `src/components/SurgicalDashboard.tsx`.

## Scope

Only the **Power BI–sourced** records are in scope (the `SURGICAL_RECORDS` written
by `powerbiScraper.ts`, identifiable by `source_name: "Alberta Health System
Dashboard (Power BI)"`). CIHI / ABJHI / Fraser records in the same file are
out of scope for this audit.

## Confirmed errors

### S1 — Wait segment mislabeled "Referral-to-treatment" (it is Ready-to-Treat to Treatment)

**Severity: P1 (data-integrity / public-facing mislabel).**

- `powerbiScraper.ts:379,414,433,460` hardcodes `wait_segment: 'Referral-to-treatment'`
  for **every** record (wait, volume, % within benchmark, facility).
- The site repeats this claim:
  - `SurgicalDashboard.tsx:532-534` — "Referral to treatment … Power BI pathway
    median from referral through treatment — not the same as classic Wait 1 consult."
  - `SurgicalDashboard.tsx:612-614` — "Referral to Treatment" panel header.
- **Actual source measure:** the Alberta Health System Dashboard reports surgery
  waits as **RTT — Ready to Treat to Treatment**: from when a specialist deems the
  patient ready for surgery to the surgery date. This is the classic **Wait 2 /
  decision-to-surgery** segment, **not** a referral-through-treatment pathway
  measure. (AHS methodology; confirmed via Alberta Health Services dashboard
  description: "the time from when a patient is deemed 'ready for surgery' by a
  specialist to the date the surgery is actually completed.")
- **Impact:** the site tells users these are full-pathway referral-to-treatment
  medians. They are not. They are Wait-2 (ready-to-treat) measures. This is the
  exact misstatement the user flagged.

**Fix:** relabel the segment to `Decision-to-surgery` (the existing enum value
already used by the CIHI Wait-2 records), with `method_note` clarifying
"Ready-to-Treat to Treatment (RTT, Wait 2)". Update the dashboard panel copy.

### S2 — Cancer surgery units are "weeks"; source reports days

**Severity: P1 (units wrong for an entire procedure group).**

- `powerbiScraper.ts:382` assigns `unit: 'weeks'` to all wait records
  unconditionally. The field is even named `waitWeeks` (`:143,360-362`), baking
  the assumption in.
- Cancer surgery records in `data-surgical.json:447-515`:
  Bladder 11, Breast 13, Colorectal 12, Lung 8, Prostate 32 — all `unit: "weeks"`.
- **Actual source unit:** CIHI priority cancer surgery waits (bladder, breast,
  colorectal, lung, prostate — the same five the dashboard carries) are reported
  in **days** at the 50th/90th percentile. 8–32 **days** is a plausible cancer
  surgery RTT; 8–32 **weeks** is not (and would exceed the cancer benchmark
  window). The Power BI cancer surgery tiles display days, consistent with CIHI.
- **Impact:** cancer surgery waits are shown ~7× too large on the site.

**Fix:** cancer surgery wait records must be `unit: 'days'`. Because the scraper
reads a single `Wait_viz` measure for all procedure types, the unit must be
**per-procedure**: weeks for elective/select surgeries (hip, knee, cataract,
bariatric, CABG), days for the five cancer surgeries. Add a `UNIT_BY_PROCEDURE`
map keyed on `procedure_group === 'Cancer Surgery'` (or the cancer procedure
names) → `'days'`, default `'weeks'`.

### S3 — "Median wait" label is incorrect for all Power BI wait records

**Severity: P1 (metric label wrong for every wait row).**

- `powerbiScraper.ts:380` labels every wait record `metric_name: 'Median wait'`.
- **Evidence the scraped value is not a median of the RTT segment:**
  - The same file's CIHI Wait-2 90th-percentile hip record is 36.8 / 41.2 / 34.5
    weeks (`data-surgical.json:31,65,81`). The Power BI hip "Median wait" is
    **58.1 weeks** (`data-surgical.json:416-419`). A median cannot exceed the
    90th percentile of the same segment. Since S1 establishes the Power BI
    measure is RTT (Wait 2) — the **same segment** as the CIHI 90th — the 58.1
    figure cannot be the median; it is consistent with the **90th percentile**
    RTT.
  - Alberta's surgery wait-times reporting has historically headlined the
    **90th percentile ("longest 10%")**, and this app's own overview cards are
    explicitly labeled "90th Percentile Wait Time"
    (`SurgicalDashboard.tsx:399,411,422`).
- **Conclusion (inference, evidence-backed):** the Power BI `Wait_viz` measure is
  the **90th percentile** RTT, not the median. The scraper author assumed median.
- **Verification gate before relabel:** because this is inferred, the fix must
  first confirm the Power BI tile tooltip/axis label. Step F3 below captures it
  directly from the report. If the tooltip says "90th percentile" / "longest 10%",
  relabel to `'90th percentile'`. If it says something else (e.g. mean), relabel
  accordingly. Do not ship the relabel on inference alone.

**Fix (pending F3 confirmation):** change `metric_name` from `'Median wait'` to
the verified percentile label for wait records; update `method_note` and the
dashboard panel header/column ("Median" → correct label).

## Secondary defects found during audit

### S4 — Duplicate `id` across all cancer surgery records (P2)

`powerbiScraper.ts:370` builds the wait-record id from `proc.group`:
```
id: `powerbi-${proc.group}-wait-${period}`...
```
All five cancer procedures share `procedure_group: 'Cancer Surgery'`, so all five
get `id: "powerbi-cancer-surgery-wait-april-2026"` (`data-surgical.json:439,455,
471,487,503`). This collides React keys and any `Map`-by-id dedup. The id must
include `proc.name` (or a slug of it), not just the group. Same pattern applies
to the volume and pct-target ids (`:405,424`) — verify they are unique per
procedure; the group-only slug risks collisions for any group with >1 procedure.

### S5 — `% within benchmark` scaling assumption unverified (P3)

`powerbiScraper.ts:435` does `Math.round(v.pctInTarget * 100)`, assuming
`PctInTarget_viz` returns a 0–1 fraction. Stored values (Bariatric 13, CABG 27,
Cataract 67, Hip 69, Knee 57) are consistent with a fraction × 100, so this
looks correct — but it is an assumption. F3 should print one raw `PctInTarget_viz`
value to confirm it is 0–1, not 0–100.

## Fix plan

Sequenced. F1–F2 are mechanical and safe. F3 is a verification step that gates F4.

### F1 — Per-procedure units (fixes S2)
- In `powerbiScraper.ts`, add a unit resolver:
  `const isCancer = proc.group === 'Cancer Surgery';`
  `unit: isCancer ? 'days' : 'weeks'` for wait records.
- Rename `waitWeeks` → `waitValue` (it is no longer always weeks) in
  `SurgicalWaitData` and `buildSurgicalRecords`.
- Update `method_note` to state the unit explicitly.

### F2 — Correct wait_segment (fixes S1)
- Replace `wait_segment: 'Referral-to-treatment'` with `'Decision-to-surgery'`
  at `:379,414,433,460`.
- Update `method_note`: "Ready-to-Treat to Treatment (RTT, Wait 2) — from
  specialist ready-to-treat decision to surgery date."
- Note: the `SurgicalRecord` type (`surgicalData.ts:19`) already permits
  `'Decision-to-surgery'`, so no type change is needed.

### F3 — Verify the Power BI wait percentile label (gates F4)
- Extend the scraper's response logging to print, for one `SurgWait_v2` query,
  the measure display name / tooltip text from the DSR `descriptor` (and one raw
  `PctInTarget_viz` value for S5). Run the scraper once against the live report.
- Cross-check the on-tile label by loading the Surgery tab (headed Chrome via the
  existing `CHROME_PATH` puppeteer path) and reading the tooltip/axis text.
- Record the verified label in this file before proceeding to F4.

### F4 — Relabel metric_name (fixes S3, post-F3)
- Change `metric_name: 'Median wait'` to the verified label (expected
  `'90th percentile'`) at `:380`.
- Update `method_note` accordingly.

### F5 — Unique record ids (fixes S4)
- Build ids from a slug of `proc.name`, not `proc.group`:
  `id: \`powerbi-${slug(proc.name)}-wait-${period}\`` (and likewise for volume /
  pct-target / facility). Keep facility ids by site name.

### F6 — Dashboard copy + panel semantics (fixes S1/S3 user-facing claims)
- `SurgicalDashboard.tsx`:
  - The "Referral to Treatment" panel (`:531-536,609-654`) becomes
    "Ready-to-Treat to Treatment (RTT)" with copy: "From specialist
    ready-to-treat decision to surgery date (Wait 2)."
  - The split-by-segment explainer (`:517-518`) is updated: there is no
    referral-to-treatment segment from Power BI; both panels are Wait-2 measures
    from different sources (CIHI median+P90 vs Power BI P90).
  - The "Median" column header (`:552,626`) → verified label.
  - Re-point `specialtyWaitPanels.referralToTreatment` (`:267-270`) to filter on
    `'Decision-to-surgery'` with a source filter for Power BI, OR merge into the
    Wait-2 panel as the Power BI P90 column. Decide during F6 implementation so
    the two Wait-2 sources are not shown as different segments.
- `surgicalData.ts` `_dataMetadata.SURGICAL_RECORDS.source` already says
  "Power BI scraper"; keep, but ensure no copy claims "referral to treatment".

### F7 — Backfill existing data-surgical.json
- The persisted `data-surgical.json` still carries the old labels/units. After
  fixing the scraper, either (a) re-run the scraper to regenerate the Power BI
  records, or (b) write a one-shot migration over the existing Power BI records
  (rewrite `wait_segment`, `unit` for cancer, `metric_name`, `id`, `method_note`).
  Prefer (a) so values refresh from source; use (b) only if the live report is
  unreachable.

### F8 — Verify
- `npm run build`; restart the server on :3004 bound to 0.0.0.0.
- Smoke test: load the Surgical Wait Times tab; confirm cancer surgery rows show
  **days** (not weeks), the panel says "Ready-to-Treat to Treatment", the wait
  column header matches the verified percentile label, and no duplicate-key
  warnings appear.
- Confirm `data-surgical.json` Power BI records have unique ids and correct
  units/segment/label.

## Open question for the user

- **S3 label:** my evidence says the Power BI wait measure is the 90th percentile
  RTT, not a median. F3 will confirm from the live tile. If you already know the
  exact on-tile label (e.g. "90th percentile", "longest 10%", "median"), tell me
  and I'll skip F3 and apply F4 directly.
