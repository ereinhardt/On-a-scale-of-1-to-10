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
