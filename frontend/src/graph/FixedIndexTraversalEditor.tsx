import type { DataPathSegment } from "./transitionConditions";

type Props = {
  path: readonly DataPathSegment[];
  disabled?: boolean;
  onChange: (path: DataPathSegment[]) => void;
};

function arrayLevelCount(path: readonly DataPathSegment[]): number {
  return path.filter((segment) => segment === "[]" || typeof segment === "number").length;
}

function indexes(path: readonly DataPathSegment[]): number[] {
  return path
    .filter((segment) => segment === "[]" || typeof segment === "number")
    .map((segment) => typeof segment === "number" ? segment : 0);
}

function withIndexes(
  path: readonly DataPathSegment[],
  nextIndexes: readonly number[],
): DataPathSegment[] {
  let level = 0;
  return path.map((segment) => {
    if (segment === "[]" || typeof segment === "number") {
      return nextIndexes[level++] ?? 0;
    }
    return segment;
  });
}

export default function FixedIndexTraversalEditor({
  path,
  disabled = false,
  onChange,
}: Props) {
  const count = arrayLevelCount(path);
  if (count === 0) return null;
  const currentIndexes = indexes(path);

  return (
    <fieldset className="fixed-index-traversal">
      <legend>Array traversal</legend>
      {currentIndexes.map((index, level) => (
        <div className="fixed-index-level" key={level}>
          <span>{level + 1}</span>
          <label>
            Level {level + 1} of {count}
            <select disabled value="indexed-item">
              <option value="indexed-item">Item at zero-based index</option>
            </select>
          </label>
          <label>
            Zero-based index
            <input
              type="number"
              min={0}
              step={1}
              disabled={disabled}
              value={index}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                const next = [...currentIndexes];
                next[level] = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
                onChange(withIndexes(path, next));
              }}
            />
          </label>
        </div>
      ))}
    </fieldset>
  );
}
