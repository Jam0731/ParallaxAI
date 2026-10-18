# Ledgerleaf local delivery review

Taleb · 2026-10-18 · Task LL-T001 · Product reviewed: v1.0.0, repaired and rechecked as v1.0.1

**Assessment: suitable for the requested local handoff after repair. No unresolved blocking defect was found in the inspected scope.** The product works locally and the finished marketing drafts accurately describe the bounded prototype. This is an independent worker review within this company run, not an external audit, customer acceptance, public deployment or evidence of demand.

## Scope and evidence boundary

Read the candidate Skill, assigned raw company-launch fixture, this run's company checkpoint, actual six product files, Munger's brief, and all eight substantive Ogilvy assets. Did not read other fixtures/runs/products, QA expectations, author guidance or prior test conclusions. Did not traverse `departments/ogilvy/.support`. Only Taleb departmental evidence was written; Woz repaired the product and Munger reconciled the checkpoint.

The actual UI was exercised through CUA at `http://127.0.0.1:5187/`. Node checks executed the actual `core.js` and `app.js`; a minimal DOM adapter was used only to inject storage failures. No marketing action, account access, public deployment, purchase or real customer activity was performed.

## Findings and repairs

| Finding | Impact and minimum repair | Result |
| --- | --- | --- |
| T-F01 · medium · Woz | After Start blank in the real browser, the banner claimed “Saved locally on this device” while the status correctly said the saved scenario was removed. The same contradiction occurred when a controlled `setItem` failure prevented saving. Use a neutral description that points to the real save status. | Woz changed the non-fictional banner to “Your current scenario. Check the save status below. No client information is sent anywhere.” and released local v1.0.1. Real blank-reset UI and controlled failed-save/removal checks passed on recheck. |
| T-F02 · low · Munger | Checkpoint v1 used `EXP001`; completed experiment/measurement assets used `LL-EXP-001`. A later session could split its records. Reconcile the canonical ID and retain its prior alias. | The main worker had concurrently fixed v2. Taleb independently reread v2 and v3: canonical `LL-EXP-001`, `priorCheckpointAlias: EXP001`. |

Full finding history is in `findings.json`. Original failed product-check evidence remains in `independent-check-results-before-repair.json`; the passing recheck is separate. The checkpoint reference check is byte-specific to v3; a later final merge is not represented as already reviewed.

## Checks actually executed

The v1.0.0 browser pass covered starter data, adding Moss, changing buffer, valid and incomplete saved-value restoration after reload, inconsistent capacity, blank/negative/nonnumeric validation, a markup-like literal client name, actual JSON download, row removal, blank start, explicit zero hours and reset. The repaired v1.0.1 pass covered the changed banner, footer version, an actual invalid-scenario export, phone layouts, a phone-width client edit, starter restoration and network observations. The scoped source change did not alter the arithmetic or interaction handlers.

Final source/domain/storage checks passed **18/18**, including 200 deterministic decimal arithmetic combinations, exact arithmetic at the documented 1,000-row maximum, corrupt and unsupported restoration data, zero committed hours, validation, literal-name preservation and controlled storage failures. These are the executed checks in `independent-checks.cjs`; the count is not a claim of complete coverage.

| Actual case | Observed result |
| --- | --- |
| Fictional starter | 84 h available, 78 h committed, 6 h remaining; USD 5,220; USD 66.92/h displayed. Moss is absent initially. |
| Add Moss: 12 h / USD 900 | 90 h committed, 6 h overbooked; USD 6,120; USD 68.00/h. |
| Keep Moss, change buffer to 18 h | Available capacity becomes 78 h; overbooking becomes 12 h. |
| Non-client 110 + buffer 12 > total 120 | Explicit inconsistency warning and withheld summary; no clamping to a seemingly valid zero. |
| Blank total, client hours -1, client fee abc | Separate visible errors; raw incomplete values survive reload. |
| Literal markup-like client name | Input, removal label/message and actual downloaded JSON preserve the name as text. No HTML sink or network API was found in the code. |
| No clients; all top-level values explicitly 0 | Valid zero amounts, with “Not defined: committed client hours are zero.” |
| Actual incomplete export after repair | `productVersion: 1.0.1`, `valid: false`, blank raw inputs, required-field errors and null capacity. |
| Phone viewports 390×844 and 320×740 | Screens inspected visually; no horizontal control overflow. Document client/scroll widths were 375/375 and 305/305 because of the scrollbar. At 320, changing Acorn from 36 to 35 h produced 77 committed, 7 remaining and USD 67.79/h. |
| Network observation on v1.0.1 | Reload plus reset/export/edit/restoration produced only five loopback resource requests: HTML, CSS, two scripts and local SVG. No external requests appeared in the untruncated observed window. Source also uses a `connect-src 'none'` policy and no networking APIs. |

`browser-checks.json` maps each action to its actual evidence and version. Saved screenshots include `phone-390-results.png` and `phone-320-results.png`.

The first automated-check attempt used Node's module loader on the browser `.js` file in this inherited environment and received an empty module. That was a **test-harness import failure**, not a product defect. Its output remains in `harness-initial-module-loader-failure.json`. Loading the actual browser script in a VM corrected the harness; it then produced 17 passes and the real T-F01 failure before repair, and 18 passes after repair.

## Cost and claim review

The independent recomputation is saved in `cost-recomputation.json`:

- Starter: 120 − 24 − 12 = **84 h**; 36 + 24 + 18 = **78 h**; remaining **6 h**. Fees 2,160 + 1,800 + 1,260 = **USD 5,220**. Effective revenue 5,220 ÷ 78 = **USD 66.923076…/h**, displayed as 66.92.
- With Moss: commitments **90 h**, overbooking **6 h**, fees **USD 6,120**, effective revenue **USD 68/h**. Buffer 18 changes availability to **78 h** and overbooking to **12 h**.
- Weekly budget: 60 + 120 + 60 = **240 minutes = 4 hours**. Two weeks total **480 minutes = 8 hours**. Five 15-minute sessions total **75 minutes**, leaving room within the two weekly observation/reply allocations for setup and replies; actual effort is not measured by that plan.
- Planned incremental cash spending is **USD 0**, below the **USD 30** cap. The cap grants no spending authority. This does not mean zero economic cost: compute/tool cost is unmeasured and founder labor is not priced. **USD 9 one-time remains a hypothesis**, not observed willingness to pay.

| Material reviewed | Claim assessment |
| --- | --- |
| Landing-page draft | Capabilities, starter/prospect totals, USD-only scope, local prototype status, local browser storage, JSON export without import, reset limits and absence of checkout match the implementation. Revenue is explicitly distinct from profit and predicted earnings. |
| Three launch posts | Distinct capacity, spreadsheet-comparison and hands-on angles; concrete independent-designer audience and opt-in CTA. No invented link, testimonial, customer count, guaranteed saving or demand claim. The capacity example recomputes correctly. |
| Opt-in follow-up email | Complete unsent draft, recipient unset; consent required for one follow-up. Product scope matches. The price question asks for intent/reasons without calling the response an order. No send was performed. |
| Acquisition experiment | Fits the stated time and planned cash constraints. It treats the supplied interviews as fictional, excludes the studio mismatch, uses an answer-free recruitment post for scored tasks and separates setup friction from task performance. The first-five completed cohort rule, refusals and unknown evidence are described. Passing the provisional thresholds supports another small test only. |
| Metric dictionary and three CSV records | Unknown, zero, partial and not-applicable are distinguished. Opt-ins, free receipt, usage, stated intent, orders and net receipts have separate definitions. Rates require matched cohorts/windows. All three CSV files were parsed and have zero data rows: they are templates, not evidence of zero customers or a failed experiment. |

No marketing repairs were required. All substantive Ogilvy files remained byte-identical during review, so the same reviewed copy remains compatible with the narrowly repaired v1.0.1 product.

## Version identity and remaining boundaries

`inspected-hashes-initial.json` and `inspected-hashes-final.json` contain full SHA-256 values for each inspected product/brief/marketing artifact. `source-hashes.json` identifies the candidate, raw fixture and checkpoint v3 reference. Key repaired-file hashes:

- `product/app.js`: `6BABE7059EA51C54F69FD30198FE07C31F645048661E13E7BFDB1AB3010F2BED`
- `product/core.js`: `9F306ACA61DFDB6691774DE19A950E00A63C3BCC769739C9E9C968591EE2BB92`
- `product/index.html`: `5B51F52267973B933D0E8D9C142515C7F722C7F8591E8EF34EDBEBBD3476F748`

Not verified: physical-phone behavior, Safari/Firefox, assistive-technology operation, real browser quota/permission failure conditions, recipient-side setup, production hosting, customer preference, willingness to pay, conversion, sales or profitability. Storage error branches were tested with a controlled adapter rather than real browser failure settings. No broad security guarantee is implied by a source review and one network window.

The final preview was left on the three-client fictional starter with the default viewport restored. The loopback preview process was not stopped. Munger can merge the resolved findings and exact references; Woz owns later technical changes; Ogilvy owns any later authorized experiment. The existing local review does not authorize external execution.
