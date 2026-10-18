# Ledgerleaf — product and offer brief v1

Decision date: 2026-10-18. Owner: Munger. This is a bounded product decision, not evidence of demand.

## Decision and buyer

Build the requested local retainer capacity planner for independent designers deciding whether another monthly retainer fits. Keep a single person, one month and USD as the chosen currency. The supplied fictional interviews A and B describe checking commitments before accepting work. Neither interview demonstrates willingness to pay. Interview C describes an eight-person studio seeking payroll, timesheets, invoices and permissions; those needs do not fit this product. Do not expand into studio operations.

A spreadsheet already supports the arithmetic. Ledgerleaf's proposed reason to exist is a ready-made, focused screen with capacity validation, a visible overbooking warning, local persistence and export. Whether this convenience warrants a purchase is untested. USD 9 one-time is the founder's price hypothesis, not an approved public sale or a researched market price.

## Product behavior and acceptance

- Runs as a static browser application with no backend, accounts, external libraries, external resources or application network calls. A static HTTP preview is the local delivery mechanism.
- Total monthly hours minus non-client hours minus reserved buffer equals client capacity. All fields are required, finite and nonnegative. Combined non-client and buffer hours above total hours invalidates the plan instead of clamping capacity to zero.
- Add, edit and remove named clients with monthly hours and monthly fees in USD. Names remain literal text. No HTML interpretation.
- Display available client hours, committed hours, remaining or overbooked hours, monthly revenue and revenue per committed client hour. Zero committed hours produces an explicit undefined-rate explanation. Revenue is not profit.
- Persist the raw scenario in this browser profile and origin; explain storage, limitations and reset behavior. Reset removes this application's saved scenario and returns to blank inputs. Export a readable, versioned JSON scenario, including raw invalid values if the owner needs a backup; identify validation status.
- Default to the labeled fictional starter (120 / 24 / 12 hours; Acorn 36 h / USD 2,160; Fieldline 24 h / USD 1,800; North Leaf 18 h / USD 1,260). Provide a blank start. Do not include Moss by default; the owner can add the 12 h / USD 900 prospect.
- Work on desktop and phone. Complete local checks and provide use/continuation instructions.

## First validation attempt

Use a two-week, zero-spend proposed experiment after the prototype. Allow at most four founder hours per week: one hour preparing and selecting permitted channels; two hours of opt-in observation/replies; one hour recording and reviewing results. The USD 30 cap is unused; no spending, posting, outreach, account access, public link or sale is authorized here.

Recruit independent designers who currently track at least one retainer, only after the founder separately authorizes a channel and contact action. Ask them to compare their existing method with entering a fictional month and adding a prospect; do not request private client data. Observe task completion, validation comprehension and whether they would choose the tool again. Ask a neutral USD 9 purchase-intent question after use and record reasons and objections. Purchase intent is not an order.

Provisional decision rule: after five eligible completed observations, continue only if at least three complete the capacity task without help, at least three prefer this for that decision to their current method, and at least two independently describe a useful reason to choose it at the proposed price. Revise or stop if the main value is already met by their spreadsheet. This small convenience sample is directional, not statistical proof. Any checkout, actual sale or expansion requires a new authorized action.

## Ownership and next actions

- Woz: implement the complete static application and document local use.
- Ogilvy: finished landing-page draft, three distinct launch posts, one opt-in follow-up email draft, experiment plan and empty measurement record. Use actual capabilities and clearly state local prototype status.
- Taleb: inspect the delivered version, run relevant behavior checks, recompute scenario and budget arithmetic, inspect marketing claims, return defects to their owners and recheck repairs.
- Munger: reconcile the checkpoint and use actual future observations to choose the next bounded iteration.
