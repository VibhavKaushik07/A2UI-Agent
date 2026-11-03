export interface SearchStep {
  left: number;
  right: number;
  mid: number;
  line: number;
  text: string;
  found: boolean;
}
export function binarySearch(input: number[], target: number): SearchStep[] {
  if (
    !input.length ||
    input.length > 50 ||
    !input.every(Number.isFinite) ||
    !Number.isFinite(target)
  )
    throw Error("Enter 1–50 finite numbers and a finite target.");
  if (input.some((v, i) => i > 0 && v < input[i - 1]))
    throw Error("Binary search requires a sorted array.");
  const steps: SearchStep[] = [];
  let left = 0,
    right = input.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const found = input[mid] === target;
    steps.push({
      left,
      right,
      mid,
      line: found ? 2 : input[mid] < target ? 3 : 4,
      text: found
        ? "Found " + target + " at index " + mid
        : input[mid] < target
          ? input[mid] +
            " is smaller than " +
            target +
            ". Move left to " +
            (mid + 1) +
            "."
          : input[mid] +
            " is larger than " +
            target +
            ". Move right to " +
            (mid - 1) +
            ".",
      found,
    });
    if (found) return steps;
    if (input[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  steps.push({
    left,
    right,
    mid: -1,
    line: 5,
    text: "Target not found: left is now greater than right.",
    found: false,
  });
  return steps;
}
export interface LeftRow {
  id: number;
  name: string;
}
export interface RightRow {
  customerId: number | null;
  item: string;
}
export const customers: LeftRow[] = [
  { id: 1, name: "Asha" },
  { id: 2, name: "Ben" },
  { id: 3, name: "Chen" },
];
export const orders: RightRow[] = [
  { customerId: 1, item: "Notebook" },
  { customerId: 1, item: "Pen" },
  { customerId: 3, item: "Book" },
  { customerId: 4, item: "Bag" },
];
export function join(
  left: LeftRow[],
  right: RightRow[],
  type: "INNER" | "LEFT",
): { id: number; name: string; item: string | null }[] {
  return left.flatMap<{ id: number; name: string; item: string | null }>(
    (l) => {
      const matches = right.filter(
        (r) => r.customerId !== null && r.customerId === l.id,
      );
      return matches.length
        ? matches.map((r) => ({ ...l, item: r.item }))
        : type === "LEFT"
          ? [{ ...l, item: null }]
          : [];
    },
  );
}
export function descent(rate: number, start = 4, count = 30) {
  if (!Number.isFinite(rate) || rate < 0.01 || rate > 1.2)
    throw Error("Learning rate must be 0.01–1.2");
  const steps = [];
  let x = start;
  for (let i = 0; i <= count; i++) {
    steps.push({ iteration: i, x, loss: x * x });
    if (Math.abs(x) > 1e6) break;
    x -= rate * 2 * x;
  }
  return steps;
}
