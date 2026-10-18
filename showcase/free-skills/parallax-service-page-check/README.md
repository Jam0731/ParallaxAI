# Parallax Service Page Check

Find what makes your service page confusing before you share it. Get up to five specific fixes for your offer, claims and contact step.

**Free. No other Parallax purchase required.** Your AI assistant's own usage fees may still apply.

## Start with your page

1. Install this Skill in your project using the command below.
2. Open your skill-capable assistant in that project.
3. Paste your page copy or HTML, plus the facts you can support. Ask for the review using this starter:

```text
Use parallax-service-page-check to review my service page.

My service and intended customer:
[What you do and who you do it for.]

Facts I can support:
[Deliverables, scope, real price if known, timing, experience and contact route.]

Current page:
[Paste the headline, offer, proof and contact copy, or the complete HTML.]

Tell me what a buyer understands, the most important fixes and what still
needs checking. Use only the facts supplied. Do not submit forms or send messages.
```

You receive a short verdict, up to five fixes with replacement wording where possible, and any remaining checks. A page that already works does not need five invented problems.

## Install in a Codex project

Run from the project where you want to use the Skill:

```sh
npx skills add https://github.com/Jam0731/ParallaxAI/tree/main/showcase/free-skills/parallax-service-page-check --agent codex --skill parallax-service-page-check --copy
```

This installs only the free page checker in that project. It does not install the ParallaxAI gateway or the repository's other skills. This exact source was checked through a fresh project installation on 18 October 2026.

For another skill-capable assistant, use its supported local Skill installation method with [SKILL.md](SKILL.md). You can review the full instructions before installing.

## See an actual result

[Open the complete input and review](../../examples/service-page-review.md). The fictional podcast-editing example has conflicting package promises, unsupported proof and a form that displays success without sending anything. The actual review identifies four changes and supplies replacement wording.

![Actual findings from the fictional page review](../../images/service-page-check.png)

The Skill reviews what you provide. With copy only, it cannot claim to have checked the rendered layout or live contact behavior. It does not measure conversion, rebuild a site or send a test inquiry.

Found a concrete problem with a review? [Open a repository issue](https://github.com/Jam0731/ParallaxAI/issues) with the request, the relevant result, your assistant and the change you expected. A short fictional example is enough to reproduce most problems; share only material you can publish.

[More free examples and Parallax tools](../../README.md) · [MIT license](../../../LICENSE)
