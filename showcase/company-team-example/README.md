# A four-department team, doing the work

A fictional Ledgerleaf business asked the Parallax team to make a working retainer-capacity planner, prepare its launch material and review the result. These are selected actual outputs from that local Skill trial, not customer work or a measured business success.

| Department | What this run produced | Open the actual work |
|---|---|---|
| Munger | A product and offer decision for independent designers, with assumptions and limits | [Product brief](departments/munger/product-offer-brief.md) |
| Woz | A responsive working planner with calculations, validation, browser persistence and JSON export | [Application files](product/) |
| Ogilvy | Finished landing-page copy, three posts, an opt-in email draft and a measurable test plan | [Landing copy](departments/ogilvy/landing-page.md) · [Posts](departments/ogilvy/launch-posts.md) · [Email](departments/ogilvy/opt-in-follow-up-email.md) |
| Taleb | Actual artifact review, recomputed costs and a saved-status defect returned for repair and rechecked | [Review](departments/taleb/review.md) |

[Read the original request](input.md) · [Company record](company-example.json) · [Experiment](departments/ogilvy/acquisition-experiment.md) · [Blank measurement log](departments/ogilvy/measurement-log.csv)

![The actual local planner produced by the team](images/product.jpg)

## Try the generated example

[Download the generated example](ledgerleaf-example.zip), or take the five files in `product/`. Serve that folder with a local static HTTP server and open its local address in a modern browser. The files use no external libraries, account, backend or application network API. The browser stores the scenario for that local address; export a JSON copy if you want to retain it separately.

The supplied example shows 84 available client hours, 78 committed and 6 remaining. Adding the fictional Moss prospect makes it 6 hours over capacity. All names, fees and business details are fictional.

This is the frozen v1.0.1 example from the original request. Later continuation tests are separate; this page does not represent a product sold by Ledgerleaf or an active experiment.

## What was checked

The engineering pass executed calculation and validation checks. A separate Taleb worker reviewed actual code, browser behavior, marketing claims and cost arithmetic. It found a persistence-status message that could falsely suggest a save had succeeded; Woz repaired it, and Taleb rechecked the affected paths. Reviews and code hashes identify the inspected version. Detailed evaluator-only test files referenced in the review remain in the private validation archive.

The lead worker handled Munger and Woz passes; Ogilvy and Taleb each used a separate worker. This run does not demonstrate four simultaneous background processes. No customer was contacted, no paid service was bought, and no sale or customer outcome was measured.

[Back to Parallax examples](../README.md). The complete four-department Skill has been submitted as a v1.1 update to the existing Client Delivery Team listing. It is awaiting Agensi review; the publicly approved package is still v1.0. This example previews the tested upgrade, which is not yet available through the marketplace. The purchase link will be added after the new version is approved and verified.
