/**
 * Sine integral Si(x) = ∫₀ˣ sin(t)/t dt, via the standard alternating power
 * series. Converges quickly for the x ranges patch-antenna analysis produces
 * (x = k0*W, typically < 10), so a fixed 100-term sum is more than enough
 * precision without needing the large-x asymptotic expansion.
 */
export function sineIntegral(x: number): number {
  if (x === 0) return 0;
  let sum = 0;
  let sign = 1;
  let xPower = x;
  let factorial = 1;
  for (let n = 0; n < 100; n++) {
    const denom = 2 * n + 1;
    sum += (sign * xPower) / (denom * factorial);
    sign *= -1;
    xPower *= x * x;
    factorial *= (2 * n + 2) * (2 * n + 3);
  }
  return sum;
}

/** Bessel function of the first kind, order 0, via its power series. */
export function besselJ0(x: number): number {
  let sum = 0;
  let sign = 1;
  const halfX = x / 2;
  let power = 1;
  let factM = 1;
  for (let m = 0; m < 60; m++) {
    sum += (sign * power) / (factM * factM);
    sign *= -1;
    power *= halfX * halfX;
    factM *= m + 1;
  }
  return sum;
}
