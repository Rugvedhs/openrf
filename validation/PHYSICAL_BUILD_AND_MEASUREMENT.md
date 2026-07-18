# Physical validation — build and measure a real patch, compare to the prediction

This is the third and final leg of validating OpenRF, after the closed-form-vs-textbook
check (`src/verify.ts`, 0.02–0.17% error) and the independent finite-difference eigenvalue
check (`cavity_eigenmode_check.py`, 0.55% error). Both of those confirm the *math* is
self-consistent. Neither confirms the *model* — the transmission-line/cavity idealization
itself — matches reality. Only building a real antenna and measuring it does that.

Budget: **under $40** and one evening, assuming you already have (or can borrow) a NanoVNA.

---

## 1. Pick a design and freeze its numbers

Open the app, pick **2.45 GHz, FR4, h = 1.6 mm, target 50 Ω** (the app's own defaults —
using the default means anyone checking your work can reproduce the exact prediction
without guessing your inputs). Record every number in the "Synthesized geometry" panel
before you touch a soldering iron:

| Quantity | App's prediction (fill in) |
|---|---|
| Width W | |
| Length L | |
| Inset feed depth y0 | |
| Predicted resonant frequency | 2.450 GHz (by construction) |
| Predicted edge resistance Rin | |
| Predicted −10dB bandwidth | |

## 2. Bill of materials

| Item | Spec | Approx. cost | Notes |
|---|---|---|---|
| FR4 PCB, single-sided copper | 1.6 mm thick, εr≈4.4, at least 60×60 mm | $5–10 for a small panel | Any hobbyist PCB stock (e.g. from an electronics supplier) works — the exact εr varies by batch, which is itself part of what you're testing |
| SMA edge/through-hole connector | 50 Ω, panel-mount or through-hole | $2–5 each | Get 3–4 — you will get solder joints wrong at least once |
| Copper etching kit *or* a PCB prototyping service | Ferric chloride + resist pen, or send the Gerber to a fab (JLCPCB/PCBWay etc.) | $10–20 (etch kit) or $5–15 (2-day fab turn, 5-piece minimum) | Fab route is more accurate (etch tolerance ~1 mil vs. hand-etch which can be off by many mils) and cheap enough not to matter at this scale — recommended if you have a week of lead time |
| NanoVNA (or NanoVNA-H/V2) | Any current hobbyist VNA, ~50kHz–3GHz or better | $30–60 if you don't have one | This is the one piece of test equipment the whole plan depends on |
| SMA calibration kit | Open/short/load standards (often bundled with the NanoVNA) | usually included | Confirm before ordering separately |
| Coax jumper, SMA-SMA | Short (≤15cm), good quality | $5 | Keep it short — cable loss/phase error matters at these frequencies |

If ordering from a fab: draw the exact rectangle W × L from step 1, centered on a ground
plane at least `L + 6h` larger in each dimension (a common rule of thumb so the finite
ground plane doesn't distort the pattern), with the feed via/pad at the inset depth y0
from one edge, centered along the width. Keep the *fab's* copy of these numbers — that's
your as-fabricated record for comparison against the design target.

## 3. Fabricate

- **Fab route (recommended)**: export the rectangle as a simple 2-layer board — top layer
  is the patch (copper rectangle, W×L, with the feed pad/via at y0), bottom layer is solid
  ground fill. Standard 1.6mm FR4 stackup is usually the default at any prototyping fab, so
  you often don't need to specify anything unusual.
- **Hand-etch route**: transfer the rectangle onto copper-clad board with a resist pen or
  toner-transfer, etch in ferric chloride, and measure your actual W/L with calipers
  afterward — **write down the actual measured dimensions, not the design target**, since
  hand-etching easily drifts ±0.2–0.5mm, which matters at these electrical sizes.
- Solder the SMA connector's center pin to the feed point at depth y0, and its shield/ground
  tabs to the ground plane (through-hole via, or direct solder tab on the ground layer,
  depending on the connector style you bought).

## 4. Calibrate the NanoVNA

1. Set the sweep to a band centered on your target frequency — e.g. 2.0–2.9 GHz for the
   2.45 GHz default (about ±4 predicted bandwidths either side, wide enough to see the
   full dip and confirm nothing else resonates nearby).
2. Run a full 1-port SOL (short/open/load) calibration **at the end of the coax jumper you
   will use** — not at the VNA's own port. This matters: calibrating at the VNA port and
   then attaching a cable moves the reference plane and corrupts phase-sensitive
   measurements (S11 magnitude is less sensitive to this than phase, but do it right anyway
   — it costs two minutes).
3. Save the calibration before connecting the antenna.

## 5. Measure

1. Connect the antenna via the calibrated jumper. Keep it away from your body, the desk's
   metal parts, and other conductors during measurement — near-field detuning from a
   nearby hand or laptop chassis is the single most common cause of "the antenna doesn't
   match the prediction" in a first attempt, and it's not a modeling error.
2. Record the measured **S11 vs. frequency** (or return loss / VSWR, whichever your
   NanoVNA's software shows) across the swept band.
3. Read off: the frequency of the S11 minimum (measured resonant frequency), the S11 value
   at that minimum (in dB — converts to VSWR and hence a measured "match quality"), and the
   −10dB bandwidth (the frequency span where S11 stays below −10dB).

## 6. Compare and record

| Quantity | Predicted (step 1) | Measured | Δ (absolute) | Δ (%) |
|---|---|---|---|---|
| Resonant frequency | | | | |
| −10dB bandwidth | | | | |
| S11 at resonance (dB) | | | — | — |

A few percent error on resonant frequency is a *good* result for this model class — it's
consistent with the known limitations already documented in the app (`patch.ts`'s
`modelValidityWarnings`): unmodeled conductor loss, connector parasitic inductance, ground
plane finiteness, and normal FR4 εr batch variance (±5–10% is typical and alone can shift
resonance by roughly half that in frequency, since f0 ∝ 1/√εreff). If your measured
frequency is within ~2–5% of predicted and the dip is at least modestly deep (below
roughly −10dB), that's a genuine, creditable confirmation of the model — write it up with
the actual numbers, not just "it worked."

If it's wildly off (>10%), the most likely causes in rough order of frequency: (1) solder
joint/connector fault — reflow and recheck with a multimeter continuity test first, (2)
near-field detuning from measurement setup, (3) actual substrate εr far from the FR4
nominal 4.4 used in the design (cheap/unknown-origin FR4 varies more than name-brand
laminate), (4) an error in transcribing W/L/y0 from the app to the board.

## 7. Write it up

The strongest version of this result states, in order: what the closed-form model
predicted, what an independent numerical method (the eigenvalue solver) confirmed about
the model's internal math, and what a physical measurement showed about the model's
correspondence to reality — with an honest percentage error at each step. That three-step
chain (closed-form → independent numerics → hardware) is what turns "I built a calculator"
into "I characterized where a textbook model holds up and where it doesn't," which is the
actual point of doing this.
