# OpenRF validation

Three independent legs, each checking a different failure mode. None of them substitutes
for the others — that's the point.

| Leg | What it checks | What it can't catch | Result |
|---|---|---|---|
| **1. Closed-form vs. textbook** (`src/verify.ts`, `src/patch.test.ts`) | The TypeScript implementation correctly reproduces Balanis' own published worked example (Example 14.1) | Nothing — if the textbook's equations are wrong or misapplied to reality, this would still pass, since it's checking against the same equations | 0.02–0.17% error across 6 parameters |
| **2. Independent numerical eigenvalue solve** (`cavity_eigenmode_check.py`) | The resonant-frequency *algebra* is self-consistent, via a completely different computational method (finite-difference PDE eigenvalue solve vs. closed-form formula) — catches transcription errors, sign errors, wrong mode selection | The underlying cavity-model physics itself (PMC side walls, no radiation, no surface waves) — this uses the same idealization, just solves it a different way | 0.55% error across 3 frequency/substrate cases (see script output) |
| **3. Physical build + measurement** (`PHYSICAL_BUILD_AND_MEASUREMENT.md`) | Whether the model corresponds to reality at all — conductor loss, connector parasitics, finite ground plane, real substrate variance, radiation effects the cavity idealization ignores | — this is the ground truth leg | Pending — do this one yourself; the guide has the full BOM and procedure |

*Supplementary (not a fourth leg — see `INDEPENDENT_CALCULATOR_CROSSCHECK.md`):* OpenRF's
dimensional output (W, L, εr,eff) matches two other independently-written free calculators
(vinoth.org, rftools.io) to within 0.01–0.07%, and one of them (vinoth.org, which publishes
the identical full G1+G12 formula set) matches OpenRF's edge resistance to 0.02%. This
confirms the *arithmetic* is implemented correctly against other people's independent code —
it is explicitly **not** a substitute for leg 3, since none of these tools have ever measured
a real antenna either. See that file for the honest version of what this does and doesn't prove.

## Why leg 2 is worth reading even though it "just confirms the same model"

Building `cavity_eigenmode_check.py` caught two real, distinct bugs before it produced a
correct number:

1. A finite-difference Neumann boundary condition implemented via the naive ghost-point
   trick produces a **non-symmetric matrix**, which a symmetric eigensolver (scipy's
   `eigsh`) silently accepts and returns garbage for — including nonsensical negative
   eigenvalues for a provably positive-semi-definite operator. Caught by checking the
   result against the known-exact 1D case before trusting the 2D one.
2. The lowest nonzero eigenvalue of a 2D Neumann-Laplacian rectangle is **not always the
   TM010 mode** — when the patch is wider than it is long (true for every default case in
   this project), the (0,1) mode's eigenvalue is lower than the (1,0) mode's. Blindly
   taking "the second-smallest eigenvalue" silently picks the wrong physical mode. Caught
   by computing several low eigenmodes and checking their *shape* (uniform along one axis,
   varying along the other) rather than just their eigenvalue rank.

Both bugs produced plausible-looking wrong numbers (10–20% relative error) that would have
been easy to mistake for "expected discretization error" if the debugging hadn't happened.
That's the actual value of building an independent check: not that it's guaranteed correct
on the first try, but that getting it right required understanding the physics well enough
to recognize a wrong-but-plausible answer instead of accepting it.

## Running leg 2 yourself

```
cd validation
pip install numpy scipy
python cavity_eigenmode_check.py
```

Takes several minutes at the resolution the script defaults to (a ~1500x1500ish sparse
eigenvalue problem); this is a one-time validation check, not something meant to run on
every design change.
