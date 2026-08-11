# CloudSteps DESIGN.md — Warm Mint

> Hybrid of **Mintlify** (mint accent, reading clarity) × **Notion** (warm surfaces, low-pressure calm).  
> Product: 云阶 CloudSteps — coaching, vocabulary training, scenario dialogue.

## 1. Visual Theme & Atmosphere

Warm white reading space with mint as the only action signal. Pages feel like a soft workspace (Notion), while CTAs, focus rings, and active states speak Mintlify green. No cinematic dark heroes, no purple brand, no black-pill marketing buttons.

**Key characteristics**
- Page canvas is warm surface (`#f6f5f4`), content cards are white
- Brand mint (`#4ECDC4`) reserved for CTA / focus / active / success feedback
- Soft hairline borders over heavy shadows
- Body line-height ≥ 1.55 for learning comfort
- Radius stays sober (8–12px interactive, ≤16px content)

## 2. Color Palette & Roles

### Brand & accent
| Token | Hex | Role |
|-------|-----|------|
| `brand-mint` / primary | `#4ECDC4` | Primary CTA, focus ring, active nav, links of emphasis |
| `brand-mint-deep` | `#3db8b0` | Pressed / hover on mint |
| `brand-mint-soft` | `rgba(78, 205, 196, 0.12)` | Tint surfaces, selected bg |
| `brand-secondary` | `#55A3FF` | Secondary category only (e.g. student/blue entry) — never primary CTA |

### Surfaces
| Token | Hex | Role |
|-------|-----|------|
| `canvas` | `#ffffff` | Cards, modals, elevated content |
| `surface` | `#f6f5f4` | Page / app background |
| `surface-soft` | `#fafaf9` | Quieter nested bands |
| `hairline` | `#e5e3df` | Default borders / dividers |
| `hairline-strong` | `#c8c4be` | Input rest border |

### Text
| Token | Hex | Role |
|-------|-----|------|
| `ink` | `#1a1a1a` | Headlines |
| `charcoal` | `#37352f` | Body text |
| `muted` | `#787671` | Secondary / helper |
| `muted-soft` | `#a4a097` | Captions, disabled-ish labels |

### Semantic
| Token | Hex | Role |
|-------|-----|------|
| `success` | `#1aae39` | Success / completed |
| `warning` | `#c37d0d` | Caution banners |
| `error` | `#e03131` | Errors / destructive |

### Tint cards (Notion-style, sparingly)
| Token | Hex | Use |
|-------|-----|-----|
| `tint-mint` | `#e8f8f5` | Stats / positive summary |
| `tint-sky` | `#e8f2fc` | Secondary info blocks |
| `tint-cream` | `#f8f5e8` | Neutral callouts |

## 3. Typography Rules

**UI:** Plus Jakarta Sans + system Chinese fallbacks  
`Plus Jakarta Sans, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`

**Mono (words / phonetics):** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

| Level | Size | Weight | Line height | Use |
|-------|------|--------|-------------|-----|
| Page title | 24–28px | 600 | 1.25 | Screen H1 |
| Section | 18px | 600 | 1.35 | Section headers |
| Body | 16px | 400 | 1.55 | Primary reading |
| Body sm | 14px | 400–500 | 1.50 | Meta, nav, buttons |
| Caption | 12–13px | 400–500 | 1.40 | Helpers |

## 4. Component Stylings

### Buttons
- **Primary:** mint fill `#4ECDC4`, white text, radius 10–12px, hover `#3db8b0`, no heavy shadow
- **Secondary / outline:** transparent + `hairline-strong` border, charcoal text
- **Ghost:** no border, muted hover on `surface`
- **Card button:** white canvas, hairline border, hover mint border (not lift + large shadow)
- Do **not** use black pills or Notion purple pills

### Cards
- White canvas, `1px hairline`, radius 12–16px, padding 16–24px
- Default shadow: none or `0 1px 2px rgba(0,0,0,0.04)`
- Interactive: hover `border-color: brand-mint`
- Feature tint: use `tint-mint` / `tint-sky` instead of nested white-on-white

### Inputs
- Height 40–44px, radius 10–12px, border `hairline-strong`
- Focus: `2px solid brand-mint` or ring `brand-mint-soft`
- Label: 14px medium charcoal; helper: muted

### Navigation
- Active item: mint soft background + mint icon/text
- Inactive: muted text on surface sidebar

## 5. Layout Principles

- Base unit 4px; common gaps 8 / 12 / 16 / 24
- Main content max-width ~1200px; comfortable page padding 16–24px
- Prefer one visual job per section: greeting, stats, actions, schedule
- Reduce card stacking: tint blocks on surface beat white cards inside white cards

## 6. Depth & Elevation

| Level | Treatment |
|-------|-----------|
| Flat | No shadow (default) |
| Resting card | Hairline only |
| Interactive | Hairline + optional `0 1px 2px` |
| Selected | Mint border / mint-soft fill — not deeper shadow |

## 7. Do's and Don'ts

### Do
- Use mint only for CTA, focus, active, and success feedback
- Keep body in warm charcoal with generous line-height
- Put page background on `surface`, content on `canvas`
- Separate hierarchy with hairlines and tint, not shadows

### Don't
- Flood large areas with brand mint
- Introduce Notion purple or a third brand accent as primary
- Stack multiple gradients + multicolored icon rows on one screen
- Use `#1671EF` as primary (legacy Arco/theme conflict)
- Rely on `rounded-2xl` everywhere — prefer 12px, cap at 16px for large panels

## 8. Responsive Behavior

- Mobile: bottom nav keeps mint soft active pill; content padding 16px
- Touch targets ≥ 44px for primary actions
- Collapse multi-column entry grids to single column under `sm`

## 9. Agent Prompt Guide

When building or restyling UI for CloudSteps:

```
Use CloudSteps Warm Mint: page bg #f6f5f4, cards #ffffff, borders #e5e3df,
text #37352f / muted #787671, primary CTA #4ECDC4 (hover #3db8b0).
Soft tint blocks for stats. No purple, no black pills, no heavy shadows.
Typography: Plus Jakarta Sans, body 16/1.55. Radius 8–12px interactive.
```

**Quick CSS variables** (see `web/src/styles/theme.css`):
`--background` = surface, `--card` = canvas, `--primary` = mint, `--border` = hairline, `--foreground` / `--muted-foreground` = ink/muted.
