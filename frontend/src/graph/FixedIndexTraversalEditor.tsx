import type { DataPathSegment } from "./transitionConditions";
import {
  formatConfiguredPath,
  materializeIndexedPath,
  normalizeIndexedPathForEditing,
  type ArrayAccess,
} from "./transitionConditionEditorModel";

type Props = {
  source: "inputs" | "outputs";
  cataloguePath: readonly DataPathSegment[];
  executablePath: readonly DataPathSegment[];
  disabled?: boolean;
  onChange: (path: DataPathSegment[]) => void;
};

export default function FixedIndexTraversalEditor({
  source,
  cataloguePath,
  executablePath,
  disabled = false,
  onChange,
}: Props) {
  const normalized = normalizeIndexedPathForEditing(executablePath);
  const arrayAccesses: ArrayAccess[] = cataloguePath.reduce<ArrayAccess[]>(
    (accesses, segment, index) => {
      if (segment !== "[]") return accesses;
      const normalizedAccess = normalized.arrayAccesses[accesses.length];
      const executableSegment = executablePath[index];
      const value = normalizedAccess?.mode === "indexed-item"
        ? normalizedAccess.index
        : typeof executableSegment === "number"
          ? executableSegment
          : 0;
      return [...accesses, { mode: "indexed-item", index: value }];
    },
    [],
  );

  if (arrayAccesses.length === 0) return null;

  function updateIndex(level: number, index: number) {
    const next = arrayAccesses.map((access, currentLevel) =>
      currentLevel === level ? { mode: "indexed-item" as const, index } : access,
    );
    onChange(materializeIndexedPath(cataloguePath, next));
  }

  return (
    <fieldset className="correlation-array-traversal">
      <legend>Array traversal</legend>
      <div className="transition-array-levels">
        {arrayAccesses.map((access, level) => (
          <div className="transition-array-level" key={level}>
            <span className="transition-array-level-number">{level + 1}</span>
            <div className="transition-array-level-controls">
              <label>
                Level {level + 1} of {arrayAccesses.length}
                <select value="indexed-item" disabled>
                  <option value="indexed-item">Item at zero-based index</option>
                </select>
              </label>
              <label className="transition-array-index">
                Zero-based index
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={disabled}
                  value={access.mode === "indexed-item" ? access.index : 0}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    updateIndex(level, Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <p className="transition-data-picker-selection">
        Concrete scalar path:{" "}
        <code>{formatConfiguredPath(source, cataloguePath, arrayAccesses)}</code>
      </p>
    </fieldset>
  );
}
