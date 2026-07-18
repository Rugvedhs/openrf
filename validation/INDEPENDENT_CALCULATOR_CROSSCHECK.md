# Cross-check against independently-published patch antenna calculators

This is supplementary evidence, not a fourth validation leg on par with the other three
(see `README.md`). It compares OpenRF's output against two other free, independently-written
calculators for the same inputs. **It cannot replace physical measurement** — see the "why
this isn't validation" section below before reading too much into it.

Inputs used for all three tools: f0 = 2.45 GHz, εr = 4.4 (FR4), h = 1.6 mm, target Zin = 50 Ω.

## Results

| Quantity | OpenRF | vinoth.org | rftools.io |
|---|---|---|---|
| Width (W) | 37.2343 mm | 37.26004 mm | 37.23426 mm |
| Length (L) | 28.8093 mm | 28.82964 mm | 28.80929 mm |
| εr,eff | 4.08086 | (matches to displayed precision) | 4.08086 |
| G1 (self conductance) | 0.0009693 S | 0.00096929 S | not shown |
| G12 (mutual conductance) | 0.0005862 S | 0.00058619 S | not shown |
| **Rin (edge resistance)** | **321.4 Ω** | **321.44529 Ω** | **306.8 Ω** (flagged "WARN" on their own page) |
| Inset feed depth (50Ω) | 10.69 mm | 10.6945 mm | ~8-10mm (worked-example text, not the live calculator) |
| Radiation Q | 119.9 | not reported | ≈38.6 (via their stated formula `Q ≈ c·√εeff/(4·f·h)`) |
| Bandwidth (VSWR≤2) | 0.59% | not reported | ≈1.8-2% (per their worked example) |

Sources: [vinoth.org](https://www.vinoth.org/rf-calculators/microstrip-patch-antenna-calculator),
[rftools.io](https://rftools.io/calculators/antenna/patch-antenna/).

## What this shows

**Dimensional synthesis (W, L, εr,eff) is essentially uncontested.** Three independently
written implementations agree to within 0.01–0.07% on every dimensional quantity. This is
the "easy" part of the transmission-line model — closed-form algebra with no numerical
integration — and it's about as settled as this kind of model gets.

**vinoth.org publishes the identical formula set OpenRF implements** — the same
self-conductance integral, the same mutual-conductance Bessel-function integral, the same
inset-feed cosine-squared transform — and their computed Rin (321.445 Ω) matches OpenRF's
(321.4 Ω) to 0.02%. This is meaningful: it's an independent numerical evaluation of the
*same* nontrivial double integral, converging to the same answer from a different codebase.

**rftools.io's Rin (306.8 Ω) disagrees with both OpenRF and vinoth.org by ~4.5%**, despite
matching them almost exactly on W/L/εr,eff. Since two independent sources that both publish
the full G1+G12 derivation agree with each other and diverge from the third, the likely
explanation is that rftools.io uses a simplified conductance treatment (their page marks
this specific value "WARN", suggesting they flag it as an approximation themselves).

**No two sources agree on bandwidth/Q**, because it depends on which physical effects get
folded in. OpenRF derives Q from the actual computed radiation conductance (G1+G12) and
cavity capacitance (`Q = ω0·C/Gin` — an energy-based derivation tied to this specific
design's numbers). rftools.io uses a compact scaling-rule approximation
(`Q ≈ c·√εeff/(4·f·h)`) that isn't derived from the specific design's conductance at all —
it's a generic rule of thumb. The two disagree by roughly 3x. This isn't a bug in either;
it's a real, open sensitivity in how patch bandwidth gets estimated across the field, and
it's exactly the kind of thing full-wave simulation or physical measurement resolves and a
calculator comparison cannot.

## Why this isn't validation (read this part)

All three tools here are the same *class* of prediction: closed-form transmission-line
models, none of which have ever been checked against a real, physical antenna. Agreement
between OpenRF and vinoth.org confirms the *arithmetic* is implemented correctly — it says
nothing about whether the underlying idealization (lossless PMC side walls, infinite ground
plane, no conductor loss, no connector parasitics) matches a board sitting on a bench. Three
calculators agreeing that a patch resonates at 2.45000 GHz doesn't rule out the real board
resonating at 2.40 or 2.51 GHz once you account for connector inductance and actual (not
nominal) FR4 εr — that's precisely the failure mode this kind of cross-check is structurally
unable to see. The physical build in `PHYSICAL_BUILD_AND_MEASUREMENT.md` is still the only
leg that checks that.
