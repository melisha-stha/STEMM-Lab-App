/** Short design name before parenthetical detail, e.g. `A (wood)` → `A`. */
export function shortDesignLabel(designName: string): string {
  return designName.split(' (')[0] ?? designName;
}
