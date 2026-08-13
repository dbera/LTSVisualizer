import type { DataPathSegment } from "./transitionConditions";

export function formatConcreteDataPath(
  source: "inputs" | "outputs",
  path: readonly DataPathSegment[],
): string {
  let result = source;
  for (const segment of path) {
    if (segment === "[]") result += "[0]";
    else if (typeof segment === "number") result += `[${segment}]`;
    else result += `.${segment}`;
  }
  return result;
}

export function concretizeDataPath(
  path: readonly DataPathSegment[],
): DataPathSegment[] {
  return path.map((segment) => segment === "[]" ? 0 : segment);
}

export function catalogueDataPath(
  path: readonly DataPathSegment[],
): DataPathSegment[] {
  return path.map((segment) => typeof segment === "number" ? "[]" : segment);
}
