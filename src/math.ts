export function sum(...numbers: number[]): number {
  return numbers.reduce((total, val) => total + val, 0);
}
