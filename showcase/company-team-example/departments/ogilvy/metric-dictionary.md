# Ledgerleaf measurement dictionary

Artifact: OG-METRICS-01 · Version: 1.0 · Owner: Ogilvy · Date: 2026-10-18

Applies to LL-EXP-001 and the three header-only CSV templates in this directory. Intended user: the founder or a continuing Ogilvy session recording a later authorized test. These are manual evidence records, not app analytics. No real observations are present.

## Rules that apply to every file

1. **Blank is unknown or unrecorded, never an implied zero.** In `measurement-log.csv`, also set `data_status=unknown` and explain the missing evidence. If a metric cannot apply to the activity, use `not_applicable`, leave the value blank and explain why.
2. **Zero is an observed value.** Enter `0` only after checking a defined, completed observation period and confirming that the relevant count or amount was zero. An empty template, an unposted draft or unavailable analytics cannot establish zero. In the aggregate file a numeric zero requires `data_status=observed` and an evidence reference.
3. **Partial is not complete.** An interim or incomplete count may be recorded with `data_status=partial`, a numeric value if known and a note describing the missing interval/population. Do not use it in a final rate or claim it is the experiment total.
4. Store counts as nonnegative whole numbers, money as decimal USD amounts, minutes as nonnegative numbers, and rates as decimal fractions from 0 to 1. Do not put currency signs or percent signs in numeric cells. Undefined rates stay blank, with their reason in notes. Do not divide by zero.
5. CSV files are UTF-8, comma-delimited with one header row. Quote fields containing commas, quotes or line breaks; double internal quotes. Use an actual CSV editor/exporter when entering quotes or multiline responses. When importing into a spreadsheet, set IDs, quotes and notes to text so supplied text cannot execute as a formula. There are no executable formulas in the delivered templates.
6. Use UTC ISO 8601 timestamps such as `2026-10-18T09:00:00Z` (format illustration only). For aggregate periods use start-inclusive, end-exclusive boundaries. Do not combine totals from overlapping windows or from different populations.
7. Every real participant has one pseudonymous ID throughout the experiment. Deduplicate repeat replies and repeat copy deliveries. Exclude the founder, internal reviewers, fabricated interviews and automated traffic from customer counts. Keep an exclusion note rather than silently losing records.
8. Record observations, not assumed events: an opt-in is not a download, a sent message is not confirmed delivery, a free copy is not an order, and a positive price answer is not payment. Do not manufacture an evidence link. Use a real authorized receipt or a dated local session note.
9. Leave all templates header-only until real authorized activity begins. This delivery contains no seed rows or demonstration customers. Illustrations in this dictionary are definitions, not measured results.

## measurement-log.csv

Grain: one metric for one exact period and scope. Unique key: `experiment_id + period_start_utc + period_end_utc + scope_type + scope_id + metric`. Correct an existing row with a dated explanation rather than adding a duplicate that could be summed twice. Keep prior source evidence when making a correction.

| Field | Meaning and permitted values |
| --- | --- |
| experiment_id | `LL-EXP-001` for this planned attempt. |
| period_start_utc | Inclusive beginning of the measured window; not an invented launch date. |
| period_end_utc | Exclusive end of the window. Final metrics require the same closed window. |
| scope_type | `experiment`, `source`, or `decision_cohort`. |
| scope_id | `LL-EXP-001` for experiment scope; POST-01, POST-02 or POST-03 plus an actual channel/placement identifier for source scope; `FIRST5` for the first five eligible completed sessions. Document the actual placement mapping in dated evidence. |
| metric | One of the metric names below; add a documented definition before using a new name. |
| value | Numeric value in the stated unit, or blank for unknown/not applicable. Never type “unknown” or a dash into this numeric field. |
| unit | `count`, `usd`, `minutes`, or `ratio`, matching the dictionary. |
| data_status | `observed`, `partial`, `unknown`, or `not_applicable`. Observed and partial require a numeric value; unknown and not_applicable require a blank value. |
| evidence_ref | Existing receipt, permitted platform report or dated local note identifying the exact source, window and inclusion rules. Unknown records may point to a note explaining unavailability. |
| recorded_at_utc | When the evidence was read and entered, distinct from the event window. |
| notes | Deduplication, exclusions, missing inputs, source limitations or corrections. |

### Acquisition and observation metrics

| Metric | Unit | Definition and boundary |
| --- | --- | --- |
| views | count | Channel-reported post impressions/views for the named source and period. May contain repeat exposures or founder views; preserve the platform definition and note exclusions that cannot be made. Not unique people or product visitors. Do not sum overlapping cumulative snapshots. |
| unique_visitors | count | Deduplicated people who opened the product during the named period, only if directly evidenced. This local prototype has no analytics, so ordinarily unknown. Opt-ins, impressions and file sends are not substitutes. |
| unique_opt_ins | count | Distinct non-test people explicitly asking to participate through an authorized source within the period. A like or an unsolicited collected address does not count. First source is descriptive attribution, not proof of causality. |
| free_acquisitions | count | Distinct non-test opted-in people with confirmed receipt of the free local prototype package. Count each person once in the experiment even after another delivery. This is not a verified open, completed use or order. |
| eligible_completed_observations | count | Eligible participants whose task attempt and both preference/price questions were offered and who reached the session end. Includes failed tasks and explicit refused answers. Excludes ineligible, unfinished and withdrawn sessions. |
| unassisted_capacity_successes | count | In the same completed cohort, people who independently added Moss, explained the 6-hour overbooking, changed buffer to 18 hours and explained the resulting 12-hour overbooking within the defined task attempt. Helped success is not included. |
| validation_comprehension_yes | count | Completed participants who correctly explained the inconsistent 110 + 12 > 120 example. Report separately from the main capacity task. |
| prefer_ledgerleaf | count | Completed participants explicitly choosing Ledgerleaf for their next capacity decision over their current method. “Either,” unclear responses and refusals are not positive. |
| useful_reasons_at_usd9 | count | Completed participants who independently state a concrete reason the tool would be useful to them at the stated USD 9 price. Requires the actual reason in the participant record. A polite “looks good” does not qualify. This is a qualitative signal, not payment. |
| stated_yes_at_usd9 | count | Completed participants explicitly saying they would buy at the proposed USD 9 one-time price. Track separately from useful reasons and from orders. |
| preference_refusals | count | Completed participants who explicitly decline the preference question. Missing recording is unknown, not refusal. |
| price_refusals | count | Completed participants who explicitly decline the price question. Missing recording is unknown, not refusal. |
| founder_minutes | minutes | Recorded founder time in the same period. Reconcile with time rows in effort-and-spend.csv. Do not count unused budget as time worked. |
| cash_spend_usd | usd | Actual separately authorized out-of-pocket validation expense, evidenced in the same period and reconciled to the expense ledger. Proposed budgets and fictional scenario fees are excluded. |

### Commercial metrics reserved for a separately authorized future test

The current experiment has no checkout or sales activity. Its commercial metrics are **not applicable**, with blank values, if a row is recorded at all. No commercial rows are populated now. Never infer orders from the USD 9 hypothesis or multiply intent answers into revenue.

| Metric | Unit | Definition |
| --- | --- | --- |
| paid_orders | count | Distinct completed, payment-confirmed order IDs for the relevant product and period. A request, intent answer or free acquisition is excluded. |
| refunded_orders | count | Distinct paid order IDs with a verified refund, counted once even if split into several refund events. Refund amounts are recorded separately. |
| gross_sales_usd | usd | Verified item sales before refunds and selling/payment fees, excluding any separately collected tax. Use actual transaction amounts, not price multiplied by interested people. |
| refunds_usd | usd | Verified refund amounts against the matching order cohort. |
| platform_fees_usd | usd | Verified selling/payment fees for that same order cohort. Unknown fee amounts stay unknown. |
| other_deductions_usd | usd | Other verified deductions from proceeds for the same cohort, with their nature stated in evidence. Do not guess tax or exchange-rate treatment. |
| net_receipts_usd | usd | Gross sales minus refunds, platform/payment fees and other verified deductions for the same cohort. Leave unknown if any required component is unknown. Reconcile to actual settlement evidence. This is not profit, and it excludes other business costs not deducted from those receipts. |

Do not mix a refund-date total with a sale-date total and label the result cohort conversion or profit. If a later report needs cash flow by settlement date, define that separate basis explicitly. Never use this fictional local test as sales evidence.

### Derived rates, only when evidence supports them

| Metric | Formula | Required basis |
| --- | --- | --- |
| unassisted_capacity_success_rate | unassisted_capacity_successes / eligible_completed_observations | Same completed cohort and window; all required classifications known; denominator greater than zero. |
| preference_rate | prefer_ledgerleaf / eligible_completed_observations | Same cohort; explicit refusals remain in the denominator and are disclosed; missing records make the rate unknown. |
| useful_reason_rate | useful_reasons_at_usd9 / eligible_completed_observations | Same cohort; reasons actually recorded and classified. |
| opt_in_to_free_acquisition_rate | free_acquisitions / unique_opt_ins | Same original opt-in cohort, same follow-up cutoff and person-level deduplication. Do not mix this week's deliveries to last week's people with this week's new opt-ins. |

Rates use `unit=ratio`. For the decision rule, report counts out of the first five completed eligible observations, plus refusals, before interpreting rates. If any numerator input is missing, the rate is unknown. If the denominator is zero, the rate is undefined and `not_applicable`; do not output 0%. Do not calculate a visitor-to-buyer conversion, cost per acquisition or return on spend from this unrun experiment. Unknown visitor counts cannot be replaced by views.

## participant-observations.csv

Grain: one real opt-in person per experiment. Unique key: `experiment_id + participant_id`. The original first-source ID stays stable across later replies. Keep dated notes for follow-up changes rather than overwriting the first session response with a later, more favorable response.

| Field | Meaning and permitted values |
| --- | --- |
| experiment_id | LL-EXP-001. |
| participant_id | Pseudonymous unique ID; no name, email or client details. |
| first_source_id | Actual first known recruitment placement. Blank if unknown; do not attribute a channel by guess. |
| opted_in_utc | Time of explicit participation request. |
| followup_opt_in | `yes`, `no`, or blank if not asked/unknown. `yes` needs evidence of consent to one email; it is not list consent. |
| eligible | `yes`, `no`, or blank pending screening. `yes` requires the defined independent-designer/at-least-one-retainer criteria. |
| current_method | Participant's current method in plain text; blank when not recorded. |
| copy_delivered_utc | Confirmed receipt time of local package. A planned or merely sent file does not fill this field. |
| session_status | `not_started`, `in_progress`, `completed`, or `withdrew`. Completion follows the experiment's process definition, not success. |
| session_started_utc | Actual beginning of observation, not the scheduled time. |
| session_ended_utc | Actual end of observation. |
| capacity_task_result | `unassisted_success`, `assisted_success`, `unsuccessful`, or blank if not observed. Record assistance even if the final answer is correct. |
| validation_understood | `yes`, `no`, `unclear`, `declined`, or blank if not recorded. |
| preference | `ledgerleaf`, `current_method`, `other`, `undecided`, `declined`, or blank if not recorded. |
| price_shown_usd | Actual stated one-time price in USD; 9 for this unchanged experiment. Blank if not shown. A different tested price needs a documented new experiment/version. |
| price_response | `yes`, `no`, `unsure`, `declined`, or blank if not recorded. This is stated intent only. |
| useful_reason_at_price | `yes`, `no`, `unclear`, `declined`, or blank if not recorded. Classify using the participant's reason, not their politeness or the observer's sales pitch. |
| reason_verbatim | Short exact response supporting the preference/useful-reason classification. No invented testimonial and no public reuse implied. |
| objection_verbatim | Short exact objection when offered. Blank means no recorded objection, not proof of no objections. |
| evidence_ref | Actual dated session note including consent, screening and relevant quotes. Do not insert a hypothetical URL. |
| notes | Setup friction, assistance, refusal details, exclusion reasons or subsequent dated follow-up evidence. |

Fictional Interview A/B/C and the founder's own test do not belong in this file. Separate unknown categorical values (blank) from observed “no,” “unsure,” “unclear” or “declined.” Preserve refusal as refusal.

## effort-and-spend.csv

Grain: one real time entry or one actual authorized expense. Unique key: `experiment_id + entry_id`. Do not enter both an invoice and its payment as two expenses.

| Field | Meaning and permitted values |
| --- | --- |
| experiment_id | LL-EXP-001. |
| entry_id | Stable ID unique within the experiment. |
| occurred_at_utc | Actual event time. Use a dated note for time spanning midnight/week boundaries. |
| kind | `time` or `expense`. |
| activity | Concrete activity or expense description. |
| minutes | Actual minutes for time rows; blank on expense rows. Unknown duration is blank and explained, not zero. |
| amount_usd | Actual expense amount for expense rows; blank on time rows. A budget estimate is not an expense. |
| authorization_ref | The founder's real authorization reference for an expense or external action; not the general USD 30 ceiling. For internal time use `internal-authorized-work`. |
| evidence_ref | Dated work note or actual transaction receipt; no credentials. |
| notes | Scope, partial evidence, reconciliation or corrections. |

Weekly cap: 240 founder minutes. Two-week cap: 480 minutes. Planned spend: USD 0. Maximum possible spend if separately authorized: USD 30 for the first validation attempt. The cap alone grants no authority to spend. Founder labor is time, not a fabricated wage expense.
