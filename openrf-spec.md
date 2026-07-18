# OpenRF — Tool Specification
*(working title — rename freely)*

## One-line pitch
A free, browser-based antenna and RF matching-network design optimizer. No signup, no server, no cost — runs entirely on the visitor's device.

## The problem
Real EM simulation software (ANSYS HFSS, Keysight ADS, CST Studio) costs thousands of dollars a year, putting it out of reach for students, hobbyists, and hackers doing RF/antenna work. The free alternative is a scattered collection of static "plug in a formula, get one number" calculators that don't search for a good design — they just evaluate one. Nothing free does closed-loop optimization: pick a target, let the tool search a design space, and hand back a validated candidate. That's the gap OpenRF fills.

## What it does (MVP scope)
1. User picks an antenna type — **start with microstrip patch antenna only**. (Dipole and PIFA are v2 stretch goals — resist the urge to build all three at once.)
2. User enters a target: center frequency, desired impedance (usually 50Ω), substrate dielectric constant (εr), substrate loss tangent (tan δ), and board thickness (h).
3. Tool runs an optimizer (genetic algorithm or particle swarm) over the antenna's closed-form equations, searching patch length/width and feed-point position for the design that best hits the target — minimizing error against resonant frequency, input impedance, and bandwidth simultaneously.
4. Output:
   - Recommended physical dimensions (patch length W, width L, feed inset y₀)
   - Predicted frequency response (S11/return loss curve)
   - Predicted VSWR and −10 dB bandwidth
   - A simple 2D radiation pattern approximation (E-plane and H-plane cuts)
   - A confidence/validity note — closed-form models degrade at low εr, electrically thick substrates, or frequencies where higher-order modes matter; flag when inputs push outside the model's known-good range (see **Model limitations**, below)
5. **Matching network add-on**: given a source/load impedance mismatch (and optionally a target bandwidth or Q), optimize an L-network (or pi-network) of discrete, standard-value components (E12/E24 series) to match them, with a live interactive Smith chart showing the matching trajectory.
6. Export button: dimensions + response curve + a plain-text summary of assumptions and equations used, as an image and CSV — nothing more complex than that.

## Explicitly out of scope for MVP
- Full 3D electromagnetic solving (that's what makes HFSS expensive — don't rebuild it)
- Arbitrary/free-form antenna geometries
- Multi-antenna arrays and mutual coupling effects
- Surface-wave and substrate-mode loss modeling beyond first-order approximations
- Any user accounts, saved projects, cloud sync, or backend of any kind

## Model limitations (be upfront about these)
Closed-form patch equations (transmission-line and cavity models) are known to lose accuracy when:
- εr is low (< ~2) or very high (> ~10) — fringing-field assumptions break down
- h/λ₀ exceeds roughly 0.05–0.1 — the substrate becomes electrically thick and surface-wave losses become significant
- The design targets a higher-order or non-TM₀₁₀ mode
Surface this as a plain-language warning in the UI rather than silently returning a number the user can't trust — the tool's credibility rests on knowing where its own model breaks.

## How it works technically
- **100% client-side.** No server, no API, no database. Everything computes in the visitor's browser; the entire tool works from a `file://` URL if needed.
- **Core language:** TypeScript. React is fine for the UI shell but not required — a lighter framework (or none) keeps the bundle small and the offline story simple.
- **Antenna physics:** closed-form equations for microstrip patch resonant frequency, effective dielectric constant, fringing-field length extension, and radiation Q/bandwidth — sourced from Balanis' *Antenna Theory* (transmission-line model, Ch. 14) and cross-checked against Garg/Bhartia/Bahl/Ittipiboon's *Microstrip Antenna Design Handbook*. Verify every equation against known textbook worked examples before trusting it in the optimizer loop.
- **Optimizer:** a from-scratch genetic algorithm or particle swarm optimizer (a few hundred lines, no ML library needed) minimizing a weighted error between analytical prediction and user target (frequency error, impedance error, bandwidth error). Seed the initial population near the classic first-order design equations so convergence is fast and the GA is refining, not searching blind.
- **Visualization:** a lightweight charting library (or hand-rolled Canvas/SVG) for the frequency response and Smith chart; Canvas or SVG for the radiation pattern approximation (no need for WebGL/3D — this is 2D polar plots, not a 3D far-field solver).
- **Numerical precision:** all EM calculations in double precision; round only at the final display/export step so cascaded errors don't compound through the optimizer.
- **Offline support:** service worker + PWA manifest, same pattern as Ladder — works with no connection after first load.
- **Hosting:** static build deployed to GitHub Pages or Cloudflare Pages. No backend to deploy, ever.

## User flow
1. Land on the page → pick antenna type (patch, to start)
2. Enter target frequency + substrate specs
3. Hit "Optimize" → progress indicator while the GA runs client-side (should take seconds, not minutes — if it's taking longer, that's a signal to profile the fitness function, not add a spinner with a better animation)
4. See recommended dimensions + response curve + radiation pattern + any model-validity warnings
5. Optionally tweak inputs and re-run, or lock a parameter (e.g. fixed board thickness) and re-optimize the rest
6. Export results

## Build phases
- **Phase 1 (weeks 1–2):** Patch antenna equations working correctly as a plain calculator (no optimizer yet) — verify against known textbook examples before moving on. Do not proceed to Phase 2 until at least 3 independent worked examples match published results within a few percent.
- **Phase 2 (weeks 2–4):** Add the GA optimizer on top, visualize frequency response. Sanity-check the optimizer by feeding it a target that matches a known-good design and confirming it converges back to roughly that design, not a fluke local minimum.
- **Phase 3 (weeks 4–5):** Add the matching-network optimizer + interactive Smith chart.
- **Phase 4 (weeks 5–6):** Polish UI, add PWA/offline support, deploy, post to r/AmateurRadio or Hackaday for real users.
- **Stretch:** dipole/PIFA support, physical validation (build 2–3 antennas, measure them with a NanoVNA or similar, compare to tool predictions — this is what would make it publication-worthy later).

## Metrics worth tracking (for your application narrative)
- Number of unique users / sessions (Cloudflare Pages analytics — free, no backend needed)
- Number of optimization runs completed
- Any real-world adoption signal (forum posts, GitHub stars, someone saying "I built this and it worked")

## Why this holds up as a spike
- Real, underserved gap (expensive EM software vs. free static calculators)
- Genuine EE content: antenna theory, impedance matching, optimization — not a wrapper around an API
- Zero infrastructure cost, so it's sustainable indefinitely
- Reuses your proven client-side PWA architecture from Ladder
- Has a real path to more rigor later (physical validation → publishable comparison)
