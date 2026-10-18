# Ledgerleaf acquisition experiment

Artifact: OG-EXP-01 · Version: 1.0 · Owner: Ogilvy · Date: 2026-10-18

Experiment ID: LL-EXP-001. Status: planned, not started. This document prepares a later test; it does not authorize it. No posting, contact, account access, purchase, spend or public deployment has occurred in this department's work.

## Decision and evidence

Test whether independent designers who already manage at least one monthly retainer can use the local planner and identify a reason to choose its focused screen over their existing method at a proposed USD 9 one-time price.

The founder's interview notes are fictional. A and B describe a relevant decision but no willingness to pay. C describes an eight-person studio whose payroll and team requirements fall outside this product. The spreadsheet alternative is supplied context, not independently researched market evidence. There is no verified demand, market-size estimate, competitor price comparison or conversion benchmark.

This is a small convenience sample for deciding the next prototype change. It does not establish product-market fit, willingness to complete a payment or future income.

## Audience, offer and channel

- Eligible participant: an independent designer who personally plans client hours and currently has at least one monthly retainer. A multi-person studio looking for payroll or team controls is not eligible for this test.
- Offer: a free, 15-minute opt-in session using the local prototype and fictional clients. Discuss the proposed USD 9 one-time price only after use. No payment or deposit.
- Primary channel proposal: one independent-design community's existing, explicitly permitted tool-feedback or self-promotion thread. The specific community, account and permission are unresolved and must be recorded before an external action.
- Recruitment asset: POST-02, which does not reveal the capacity answer. POST-03 is one possible week-two reminder only if the same channel permits it. Keep POST-01 and the landing page's worked example for use after the scored task or a later authorized launch. Record any prior exposure to the answer in session notes. Do not claim an A/B result from these small, differently timed exposures.
- CTA: the participant replies “planner” in that authorized channel. Do not cold-message members, scrape contacts or treat an unrelated reaction as consent.
- Delivery: after an opt-in and explicit authorization for that contact, provide Woz's verified local package and its local preview instructions through the agreed existing channel. The prototype is not publicly hosted. Record delivery only when the recipient actually receives the package; a drafted reply is not an acquisition.
- Optional follow-up: ask once, at the end of the session, whether the participant wants one feedback email. Use OG-EMAIL-01 only when the person has provided an address for that purpose and consent is recorded. A reply to a post alone does not authorize email.

## Start conditions and observation window

The founder must authorize the actual channel, posting/contact scope and test dates. Woz supplies a usable local build and setup instructions. Taleb checks that the claims in these exact draft versions match that build. These are specific dependencies for external execution, not blockers to completing the local assets.

Start the 14-day observation window at the first verified authorized recruitment post. Record start and end in UTC and keep the dates identical in each experiment-level metric. No dates are invented here. Stop new recruiting at the end of the window. Record later responses separately with a later period; do not silently mix them into the original result.

No scheduler, reminder service, analytics or customer messaging automation is created by this plan. All observation is manual. Use only metrics visible from an authorized channel or directly evidenced by a participant's action. Unique product visitors will usually be unknown because this local app has no analytics.

## Time and cash

| Per week after the prototype | Maximum minutes | Work |
| --- | ---: | --- |
| Preparation and permitted channel work | 60 | Confirm rules and authorization, choose one asset, prepare local setup and any permitted post |
| Opt-in replies and observation | 120 | Setup help, up to three 15-minute sessions, optional consented follow-up and replies |
| Recording and review | 60 | Update evidence, deduplicate participants and assess the decision rule |
| Total | 240 | Four hours; stop or rescope before exceeding it |

The same ceiling applies in week two: 480 minutes over the two-week attempt. Aim for three sessions in week one and two in week two. Recruit only enough people to reach five completed eligible observations within the time limit. Unfinished sessions and setup difficulties remain visible.

Planned incremental cash spend is USD 0. The founder's USD 30 cap is a maximum for a later authorized validation attempt, not permission to spend. No paid ads, incentives, domains, hosting or services are part of this plan. Do not count the local prototype's fictional fees or the proposed USD 9 price as money received. Log actual time and any separately authorized future expense in `effort-and-spend.csv` with evidence. No expense rows exist now.

## Session script and observation

Use the same task and scoring for each eligible participant. Do not show the arithmetic answer or coach the first attempt. Do not request real client records.

1. Confirm eligibility and consent to this session. Ask: “How do you currently decide whether another monthly retainer fits?” Record their method in their words.
2. Have the participant open Woz's local preview using its verified instructions. Record setup friction separately. Start the task with the labeled fictional starter and no Moss row.
3. Say: “A prospect called Moss needs 12 hours per month and would pay USD 900. Add that prospect. Can you fit the work without changing the existing plan? Show me the figures you used.” Then say: “Keep Moss and change the reserved buffer to 18 hours. What changes?” Allow up to five minutes for both steps without coaching. If they request help or the five minutes expire, record that before assisting. The changed buffer tests whether they can interpret a second result rather than simply recall the launch example.
4. Facilitator answer key, not participant-facing recruitment copy: original client capacity is 120 − 24 − 12 = 84 hours. Current commitments are 36 + 24 + 18 = 78 hours. With Moss, commitments are 90 hours and the plan is overbooked by 6 hours. Changing the buffer to 18 leaves 78 client hours, so the plan becomes overbooked by 12 hours. A correct unassisted response performs both changes and explains both results. The ability to repeat an answer supplied by the facilitator does not count. Restore the buffer to 12 before the next step.
5. Say: “Temporarily make non-client time 110 hours while keeping the 12-hour buffer and 120-hour total. What is the planner telling you?” Correct comprehension: the inputs are inconsistent because 110 + 12 exceeds 120, and they must be corrected before treating the plan as valid. Then restore the previous value. Record comprehension separately from capacity-task success.
6. Ask: “For your next decision like this, would you choose this planner, your current method or something else? Why?” Record preference and a short exact quote, including negative answers.
7. Ask: “If this planner cost USD 9 once, would you buy it, pass or need more information? What, if anything, makes it worth that amount to you?” Record the stated response and reason. Do not call it an order, reservation, payment or validated willingness to pay.
8. Ask separately whether they consent to one follow-up email. A refusal has no effect on the test result. End by thanking them; do not add them to a mailing list.

A completed observation means the task attempt and both the method-preference and price questions were offered, and the participant reached the end of the session. Success is not required for completion. Refusals are recorded, not overwritten with “no.” An abandoned session is `withdrew`, not completed. Preserve helped, unsuccessful and withdrawn outcomes.

## Records and interpretation

Use `participant-observations.csv` for one row per real opt-in participant, identified by a pseudonymous ID such as P001. Founder checks, fictional interview notes and internal QA never enter this file as customer observations. Use one stable ID if a person sees more than one post. Store the contact channel or any voluntarily supplied email only in an authorized private contact record; the CSV contains no contact addresses.

Use `measurement-log.csv` for measured aggregates with matching periods, scope, evidence and data status. Use `effort-and-spend.csv` for time and expense entries. All three delivered files have headers only. Empty files do not mean zero customers, zero conversion or a failed experiment. See `metric-dictionary.md` before entering data or computing rates.

At the close of day 14, use the first five eligible completed observations in chronological order. Keep all additional, ineligible and incomplete records, but report them separately so the denominator cannot be cherry-picked. Continue with a bounded next iteration only if all three provisional thresholds are met:

- At least 3 of 5 complete the capacity task without help.
- At least 3 of 5 prefer Ledgerleaf for this decision to their current method.
- At least 2 of 5 independently give a concrete reason it would be useful to them at the proposed USD 9 price. Record the participant's actual words; generic politeness is not a useful reason.

Report the three counts alongside missing/refused answers. All success fields needed to assess a threshold must have observed classifications. Missing answers do not become zero; unresolved evidence makes that threshold indeterminate. A participant who explicitly declines the question remains a completed observation and is not a positive result; disclose the refusal count. If fewer than five eligible observations finish, the decision is **insufficient evidence**, not “no demand.” Stop at the time cap and propose a new channel or narrower setup step for a separately authorized attempt.

If the threshold fails with complete observations, use the recorded reasons to choose one revision or stop. For example, repeated preference for an adequate spreadsheet is a product-value finding; a failure to open the local preview is setup friction. Do not hide either. Passing the thresholds supports another small test, not a paid launch claim.

## Next owners

Ogilvy owns future channel selection, authorized recruitment and faithful interpretation. Woz owns setup and product repairs. Taleb checks this version's claims and the delivered build, then rechecks affected repairs. Munger merges the company checkpoint and makes the next product decision from actual future observations. The founder retains authority over any external action or commercial commitment.
