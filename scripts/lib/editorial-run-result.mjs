export function zeroYieldFailure(attempted, ready) {
  return Number(attempted) > 0 && Number(ready) === 0;
}
