import * as THREE from "three"


export function rotation(p1, p2, p3, p4){
    return Math.atan2(
        p1 - p2, 
        p3 - p4
    );
}

export function roundWithPrecision(num, precision) {
  var multiplier = Math.pow(10, precision);
  return Math.round( num * multiplier ) / multiplier;
}

// OneEuroFilters for smoothing values in scene.js

export class OneEuroFilter {
    constructor(minCutoff = 1.0, beta = 0.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
        this.dcutoff = 1.0;
    }

    filter(t, x) {
        if (this.tPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0;
            this.tPrev = t;
            return x;
        }

        const dt = (t - this.tPrev) / 1000;
        this.tPrev = t;

        // Prevent division by zero or negative dt
        if (dt <= 0) return this.xPrev;

        const a_d = this.smoothingFactor(dt, this.dcutoff);
        const dx = (x - this.xPrev) / dt;
        const dxHat = a_d * dx + (1 - a_d) * this.dxPrev;

        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const a = this.smoothingFactor(dt, cutoff);
        const xHat = a * x + (1 - a) * this.xPrev;

        this.xPrev = xHat;
        this.dxPrev = dxHat;
        return xHat;
    }

    smoothingFactor(dt, cutoff) {
        const r = 2 * Math.PI * cutoff * dt;
        return r / (r + 1);
    }
}
