---
name: tradingnew-brand
description: "TradingNew Brand Kit v2.0 — the binding visual and verbal rules for this product, on the beginner-first dark system. Colour roles and tokens, the four gradients and their exclusive uses, type scale, radii, elevation, motion, trust labels, and voice. Use whenever creating or changing anything visible: a component, a page, a chart, an icon, an email, a screenshot, marketing copy, or a colour choice. Also use when reviewing UI before delivery."
---

# TradingNew Brand Kit — v2.0, dark

The binding rules for anything a person sees.

**v1.0 (light, July 2026) is superseded.** The August 2026 redesign
(`design_handoff_tradingnew_redesign`) replaced the light palette with a dark
one, moved the interaction accent from blue to mint, and made the Voyager
mascot a rendered robot. Where this file and the v1 Brand Kit disagree, this
file wins. The v1 kit is still the reference for the logo geometry and the
voice, which did not change.

**These are not suggestions.** A visual change that breaks a rule below is a
defect, not a variation. If a design genuinely needs an exception, say so and
ask — do not quietly introduce a new colour, radius or gradient.

## The one rule everything else follows from

**One accent per meaning. A colour never moonlights in another role.**

| Colour | Token | Means | Never used for |
|---|---|---|---|
| Mint `#2ee6a8` | `--tn-mint` | Interaction: hover borders, selection, the active nav underline, focus rings | Market direction — a rising price is not a focused card |
| Sky Blue `#38bdf8` | `--tn-blue` | Links, informational accents | A solid fill under white text (use `--tn-blue-strong`) |
| Deep Blue `#2563eb` | `--tn-blue-strong` | Solid button fills that carry white text | Text or borders — too dark to read on the page |
| Voyager Purple `#a78bfa` | `--tn-purple` | Voyager, Academy, learning | Generic CTAs |
| Data Green `#34d399` | `--tn-green` | Positive change, market-data label, success | Decoration, brand accents, interaction |
| Alert Red `#f87171` | `--tn-red` | Negative change, destructive actions, risk | Emphasis, "important", unread badges |
| Signal Amber `#fcd34d` | `--tn-amber-text` | Community opinion, warnings, held states | Highlights |

Mint and green are deliberately different. On this palette they are close
enough that using either for the other's job would make "this card is selected"
and "this price went up" indistinguishable at a glance — which on a financial
screen is not a cosmetic problem.

Surfaces, darkest to lightest: `--tn-bg` `#04070c` (page) · `--tn-surface`
`#070e16` (card) · `--tn-surface-veil` (a card over a space image) ·
`--tn-surface-inner` `#0a121c` (a card inside a card) · `--tn-chip-bg` `#0d1826`
· `--tn-input-bg` `#0a1522`.

Borders, faintest to strongest: `--tn-hairline-soft` · `--tn-border-hairline` ·
`--tn-border-card` · `--tn-border-inner` · `--tn-border-input` ·
`--tn-border-control` · `--tn-border-hover`.

Text, brightest to faintest: `--tn-text` `#eef4f9` · `--tn-text-body` (long
paragraphs) · `--tn-text-secondary` · `--tn-text-soft` · `--tn-text-muted` ·
`--tn-text-faint`. `--tn-text-nav` is the idle navigation item.

## Always use the token, never the hex

Every brand colour exists in `src/app/tokens.css`. Writing `#2ee6a8` in a
component instead of `var(--tn-mint)` breaks theming and hides the colour from
any audit.

The reverse mistake is worse, because it is silent: `var(--tn-surface-alt)` for
a token that was never declared drops the whole declaration, and the element
renders with the inherited value, which looks like a styling decision rather
than a bug.

```bash
# Every var(--tn-*) must name a token that exists — fails if one does not
node scripts/check-tokens.mjs

# Raw hex sitting in component CSS — should trend toward zero
grep -rhoE "#[0-9a-fA-F]{6}" src --include=*.css | sort -u | wc -l
```

## The four gradients are not interchangeable

| Gradient | Token | Used for, and only for |
|---|---|---|
| Headline | `--tn-gradient-headline` `90° #34d399 → #22d3ee` | Text-clip on a headline. **One line per screen, maximum.** |
| Primary CTA | `--tn-gradient-cta` `135° #10c98f → #0ea5e9` | The one leading action on a screen. Text is `--tn-gradient-cta-text` `#04211a` — **never white**, which is unreadable on mint |
| Secondary CTA | `--tn-gradient-cta-blue` `135° #38bdf8 → #2563eb` | "Get started", "Sign up", white text |
| Progress | `--tn-gradient-progress` `90° #10c98f → #22d3ee` | Progress bars and rings |

`--tn-gradient-logo` is the avatar and monogram tile. A gradient anywhere else —
a card, a second headline in the same view, a chip — is wrong.

## Voyager identity

**The mascot is `public/redesign/voyager-robot.png`** — a soft-edged rendered
robot with two mint arc eyes. Used at 44–236px. **Never redrawn by hand**, never
replaced with an emoji, a star or a stock avatar. Small contexts may reuse it at
≤60px.

The CSS orb (`components/voyager/VoyagerOrb.tsx`) is the v1 mark and is still
what the floating widget uses. Do not mix the two in one view: a screen shows the
robot or the orb, not both.

Buttons that open the assistant from a page read **"Voyager AI"**. The section
in the main navigation reads **"Voyager"**.

## Typography

Plus Jakarta Sans throughout. Base 15px / 1.6.

| Level | Size / weight / tracking |
|---|---|
| Hero H1 | clamp(40–62px) / 800 / −2px / 1.1 |
| Page H1 | clamp(30–54px) / 800 / −1.4…−1.8px |
| Section H2 | 20–22px / 800 / −0.4px |
| Card title | 14–19px / 800 |
| Body | 12.5–15px / 400–600 / line-height 1.5–1.6 |
| Meta / caption | 10.5–12px / 600 |

Numbers use `tabular-nums` (`.tn-num`) wherever they sit in a column or change
in place.

**One exception that overrides the scale:** any `<input>` is at least **16px**.
Below that, iOS zooms the page when the field is focused — the first thing the
box does on a phone is throw the layout sideways.

## Shape, elevation, motion

Radii: cards 14–18px · showcases 20px · buttons and inputs 9–12px · chips 8–10px
· pills 10–12px.

Shadows are far heavier than their light-theme counterparts, because on a
near-black page a shadow is an absence rather than a soft grey:
`--tn-shadow-card-hover` · `--tn-shadow-dropdown` · `--tn-shadow-modal`.

Selection is **never colour alone**. A selected card takes a mint border, a
tint, a soft glow *and* a tick; the tick is the one that still works when
colour does not. An active nav item takes a mint underline as well as white
text.

Motion: transitions 0.15–0.3s ease. `prefers-reduced-motion` is honoured
globally in `globals.css` — do not add motion that escapes it.

## Space backgrounds

Six images, `public/redesign/space-1..6.jpg`, applied with `<SpaceBackdrop
tone={n} />` from the page — never from the layout, which cannot know which
screen it is wrapping. The mapping: 1 Home / My TradingNew / Experts · 2 Start /
Learn / Supercharts · 3 Voyager / Sign in · 4 Explore / Events · 5 Compare /
News / Practice · 6 ETF detail / Plans / My Money.

A page with no backdrop falls back to `--tn-hero-bg`, which is dark and
on-brand. That is a valid choice, not a missing one.

## Trust labels are structural, not decorative

Every content block declares its type, source and update time. Facts, signals,
opinions and advertising are never mixed in one block and never share a colour.
Use `<TrustLabel>` rather than styling a chip by hand.

Any figure that is generated rather than measured says so, next to itself:
"Illustrative", "delayed data", "not price history". A `wave()` sparkline is
decoration with the shape of evidence, and it must never be allowed to pass for
evidence.

## Voice

| Principle | What it means |
|---|---|
| Trust-first | Every block declares type, source, update time |
| Value-first | Registration is asked only to save something, never as a gate. Upgrades are contextual, never banners or locks |
| Probabilistic language | Describe what may happen and what the data shows. Never predict, never instruct |
| Calm, precise, adult | No hype, no emoji, no urgency. Short sentences. Numbers speak; adjectives stay quiet |
| Progressive complexity | Essential / Detailed / Advanced are views of one product. The interface grows with the reader, never talks down |
| No fake personal metrics | An empty state shows an invitation, not a dashboard at zero. A ring at 0% beside a "next lesson" nobody chose reads as a record of failure |

**Say:** "may remain a headwind" · "options to explore" · "research plan" ·
"signals describe behaviour" · "decisions are yours"

**Never say:** "guaranteed returns" · "you should buy" · "will definitely rise"
· "start trading now" · urgency or FOMO of any kind

## Before delivering anything visual

```bash
# 1. No new raw hex in the diff
git diff --unified=0 -- '*.css' | grep -E '^\+' | grep -oE '#[0-9a-fA-F]{6}'

# 2. Every input is at least 16px
grep -rhoE '\.\w*([Ii]nput|[Ff]ield)\w*\s*\{[^}]*font-size:\s*[0-9.]+px' src --include=*.css

# 3. No emoji standing in for an icon
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src --include=*.tsx
```

Then: is every colour doing its own job? Is there at most one gradient headline
on screen? Is any selected state distinguishable without colour? Does every
generated figure say it is generated? Does any sentence promise a return?
