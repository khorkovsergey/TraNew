---
name: tradingnew-brand
description: "TradingNew Brand Kit v1.0 — the binding visual and verbal rules for this product. Colour roles and tokens, the two gradients and their exclusive uses, type scale, radii, elevation, motion, trust labels, and voice. Use whenever creating or changing anything visible: a component, a page, a chart, an icon, an email, a screenshot, marketing copy, or a colour choice. Also use when reviewing UI before delivery."
---

# TradingNew Brand Kit

The binding rules for anything a person sees. Source: `C:\Users\User\Documents\TradingView\Brand Kit` (v1.0, July 2026), derived from the live product interface.

**These are not suggestions.** A visual change that breaks a rule below is a defect, not a variation. If a design genuinely needs an exception, say so and ask — do not quietly introduce a new colour, radius or gradient.

## The one rule everything else follows from

**One accent per meaning. A colour never moonlights in another role.**

| Colour | Token | Means | Never used for |
|---|---|---|---|
| Action Blue `#2962ff` | `--tn-blue` | CTAs, links, selection, active state — **the only action colour** | Anything AI, anything about market direction |
| Voyager Purple `#7c4dff` | `--tn-purple` | Voyager, Academy, learning | Generic CTAs — a purple button is a bug |
| Data Green `#1aa966` | `--tn-green` | Positive change, market-data label, success | Decoration, brand accents |
| Alert Red `#e0492f` | `--tn-red` | Negative change, destructive actions, risk | Emphasis, "important" |
| Signal Amber `#b07708` | `--tn-amber-text` | Community opinion label, warnings, held states | Highlights |
| Ink `#131722` | `--tn-text` | Headings, body, dark buttons, brand pill | — |
| Canvas `#fbfcfe` | `--tn-bg` | Page background | — |

Tints, for surfaces of the same meaning: `--tn-blue-tint` `#e8edfd`, `--tn-purple-tint` `#efe9fd`, `--tn-green-tint` `#e3f6ec`, `--tn-orange-tint` `#fdeee3`, `--tn-amber-tint` `#fdf3e3`, `--tn-chip-bg` `#f2f4f9`.

Secondary text `--tn-text-secondary` `#5a6376`; muted `--tn-text-muted` `#8a93a6`; faint `--tn-text-faint` `#9aa3b5`.

## Always use the token, never the hex

Every brand colour already exists in `src/app/tokens.css`. Writing `#2962ff` in a component instead of `var(--tn-blue)` breaks theming and hides the colour from any future audit.

```bash
# Raw hex values sitting in component CSS — should trend toward zero
grep -rhoE "#[0-9a-fA-F]{6}" src --include=*.css | sort -u | wc -l

# Which files, so they can be fixed one at a time
grep -rlE "#[0-9a-fA-F]{6}" src --include=*.css
```

## The two gradients are not interchangeable

| Gradient | Value | Used for, and only for |
|---|---|---|
| Headline | `90°  #8b5cf6 → #2962ff` (`--tn-gradient-headline`) | Text-clip on a headline. **One line per screen, maximum.** |
| Voyager | `#7c4dff → #2962ff`, left to right | The eyes of the Voyager orb, and nothing else |
| Logo tile | `135° #2962ff → #8b5cf6` (`--tn-gradient-logo`) | The TN monogram tile |

A gradient on a button, a card, or a second headline in the same view is wrong.

## The Voyager mark

A pearl orb with two arched eyes, rendered by `components/voyager/VoyagerMark.tsx`
— never re-drawn by hand and never replaced with an emoji or a stock avatar.

The brand gradient runs through the **eyes**, left purple to right blue. The body
is near-white with its own shading: a highlight at the upper left and a crescent
of shade at the lower right. That is what gives it volume, because the mark sits
on white panels and on the near-black pill and an inline SVG cannot know which.

**Don't:** put a halo or outer glow behind it — as a gradient ring it reads as a
bloom on white and as a grey donut on dark · fill the orb with the gradient · give
it open eyes, pupils or a mouth · draw the eyes at even stroke width below 34px,
where they vanish.

It replaced a gradient tile with a white star in July 2026. Anything still showing
the star is stale.

## Logo

Monogram: rounded square, radius ≈ 30% of the side, logo gradient, white "TN" at weight 800 (≈42% of tile height). Wordmark: Plus Jakarta Sans 800, letter-spacing −0.3px, always `#131722` on light surfaces. Clear space: half the tile width on all sides.

**Don't:** flat single-colour tile · stretch or rotate · wordmark in gradient · monogram without radius · place on busy imagery without a solid backing.

## Typography

Plus Jakarta Sans throughout (Manrope is the Cyrillic carrier only — see `[locale]/layout.tsx`).

| Level | Size / weight / tracking |
|---|---|
| Hero H1 | 68 / 800 / −2.5px / 1.08 |
| Page H1 | 30–40 / 800 / −0.8…−1.2px |
| Section H2 | 26–30 / 800 / −0.6px |
| Card title | 16–20 / 700–800 |
| Body | 13.5–15 / 400–600 / line-height 1.55–1.7 |
| Meta / caption | 11–12.5 / 600 |

Numbers use `tabular-nums` (`.tn-num`) wherever they sit in a column or change in place — a price that shifts width as it updates reads as broken.

**One exception that overrides the scale:** any `<input>` is at least **16px**. Below that, iOS zooms the page when the field is focused. Body copy may be 14px; an input may not.

## Shape, elevation, motion

Radii: cards 18px · feature showcases 26px · buttons (pill) 20–24px · chips 13–18px · option rows and inputs 12–14px · hero search 36px · label pills 8–10px.

Shadows: card hover `0 10px 30px rgba(19,23,34,.09)` · dropdown `0 18px 50px rgba(19,23,34,.14)` · modal `0 24px 70px rgba(19,23,34,.25)` · hero search `0 6px 24px rgba(41,98,255,.09)` · Voyager pill `0 10px 30px rgba(19,23,34,.28)`.

Motion: all transitions 0.15–0.3s ease. Hover lift `translateY(-2px)` at 0.18s. `prefers-reduced-motion` is honoured globally in `globals.css` — do not add motion that escapes it.

## Trust labels are structural, not decorative

Every content block declares its type, source and update time. Facts, signals, opinions and advertising are never mixed in one block, and never share a colour. Use the `<TrustLabel>` component rather than styling a chip by hand.

Content-type labels ("AI explanation", "AI analysis", "AI summary", "AI structured", "Academy context") describe **what a piece of content is**. They are not product names and are never renamed when the product is.

## Voice

| Principle | What it means |
|---|---|
| Trust-first | Every block declares type, source, update time |
| Value-first | Registration is asked only to save something, never as a gate. Upgrades are contextual, never banners or locks |
| Probabilistic language | Describe what may happen and what the data shows. Never predict, never instruct |
| Calm, precise, adult | No hype, no emoji, no urgency. Short sentences. Numbers speak; adjectives stay quiet |
| Progressive complexity | Simple / Standard / Pro are views of one product. The interface grows with the reader, never talks down |
| One accent per meaning | Blue acts, purple assists, green and red measure, amber flags opinion |

**Say:** "may remain a headwind" · "options to explore" · "research plan" · "signals describe behaviour" · "decisions are yours"

**Never say:** "guaranteed returns" · "you should buy" · "will definitely rise" · "start trading now" · urgency or FOMO of any kind

## Before delivering anything visual

```bash
# 1. No new raw hex in the diff
git diff --unified=0 -- '*.css' | grep -E '^\+' | grep -oE '#[0-9a-fA-F]{6}'

# 2. Every input is at least 16px
grep -rhoE '\.\w*([Ii]nput|[Ff]ield)\w*\s*\{[^}]*font-size:\s*[0-9.]+px' src --include=*.css

# 3. No emoji standing in for an icon
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src --include=*.tsx
```

Then: is every colour doing its own job? Is there at most one gradient headline on screen? Does every content block say what kind of content it is? Does any sentence promise a return?
