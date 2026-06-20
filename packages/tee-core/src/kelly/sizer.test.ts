import assert from "node:assert/strict";
import {
  applyKellyConstraints,
  fractionalKelly,
  fractionalKellyNo,
  kellyWagerUsd,
} from "./sizer.js";

function approx(a: number, b: number, eps = 1e-6): void {
  assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);
}

// Golden vector: p=0.6, price=0.5, theta=0.5 → f* = 0.5 * (0.2) / 1 = 0.1
approx(fractionalKelly(0.6, 0.5, 0.5), 0.1);

// No edge → zero
approx(fractionalKelly(0.5, 0.5, 0.5), 0);

// Boundary prices → zero
approx(fractionalKelly(0.6, 0, 0.5), 0);
approx(fractionalKelly(0.6, 1, 0.5), 0);

// NO side
approx(fractionalKellyNo(0.4, 0.5, 0.5), fractionalKelly(0.6, 0.5, 0.5));

// Constraints cap
approx(applyKellyConstraints(0.25, 10_000, 0.1, 25), 0.1);
approx(applyKellyConstraints(0.001, 10_000, 0.1, 25), 0);

const sized = kellyWagerUsd(0.6, 0.5, 0.5, 10_000, 0.1, 25);
approx(sized.fraction, 0.1);
approx(sized.wagerUsd, 1000);
assert.ok(sized.edge > 0);

console.log("Kelly sizer tests passed (5 vectors)");
