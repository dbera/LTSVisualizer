import { useMemo, useState } from "react";
import TransitionDataFieldPicker from "./TransitionDataFieldPicker";
import type { ComparisonOperator, TransitionCondition } from "./transitionConditions";
import type { TransitionDataCatalogue, TransitionDataField } from "./transitionDataCatalogue";
import {
  countArrayLevels,
  createDefaultArrayAccesses,
  createFlatTransitionCondition,
  formatConfiguredPath,
  inferConditionValueType,
  parseConditionValue,
  readFlatTransitionConditions,
  type ArrayAccess,
  type ConditionValueType,
  type FlatTransitionCondition,
} from "./transitionConditionEditorModel";

const OPERATORS: readonly ComparisonOperator[] = [
  "=", "!=", "<", "<=", ">", ">=", "exists", "does-not-exist",
];

type Props = {
  catalogue: TransitionDataCatalogue;
  transitionName: string;
  condition: TransitionCondition | undefined;
  disabled?: boolean;
  onChange: (condition: TransitionCondition | undefined) => void;
};

function formatOperation(condition: FlatTransitionCondition): string {
  if (condition.operator === "exists") return "exists";
  if (condition.operator === "does-not-exist") return "does not exist";
  return `${condition.operator} ${condition.value === null ? "null" : JSON.stringify(condition.value)}`;
}

function formatCondition(condition: FlatTransitionCondition): string {
  const path = formatConfiguredPath(
    condition.source,
    condition.path,
    condition.arrayAccesses,
  );
  const containsLevels = condition.arrayAccesses.filter(
    (access) => access.mode === "contains-item",
  ).length;
  const qualifier = containsLevels > 0
    ? ` (${containsLevels} existential array level${containsLevels === 1 ? "" : "s"})`
    : "";
  return `${path} ${formatOperation(condition)}${qualifier}`;
}

export default function TransitionConditionEditor({
  catalogue,
  transitionName,
  condition,
  disabled = false,
  onChange,
}: Props) {
  const existingConditions = useMemo(
    () => readFlatTransitionConditions(condition),
    [condition],
  );
  const [selectedField, setSelectedField] = useState<TransitionDataField | null>(null);
  const [operator, setOperator] = useState<ComparisonOperator>("=");
  const [valueType, setValueType] = useState<ConditionValueType>("string");
  const [valueText, setValueText] = useState("");
  const [arrayAccesses, setArrayAccesses] = useState<ArrayAccess[]>([]);
  const [error, setError] = useState<string | null>(null);

  function selectField(field: TransitionDataField) {
    setSelectedField(field);
    const inferredType = inferConditionValueType(field.valueTypes);
    setValueType(inferredType);
    setValueText(inferredType === "boolean" ? "true" : "");
    setArrayAccesses(createDefaultArrayAccesses(field.path));
    setError(null);
  }

  function updateArrayAccess(level: number, access: ArrayAccess) {
    setArrayAccesses((current) =>
      current.map((item, index) => index === level ? access : item),
    );
    setError(null);
  }

  function addCondition() {
    if (!selectedField || existingConditions === null) return;
    try {
      const value = operator === "exists" || operator === "does-not-exist"
        ? undefined
        : parseConditionValue(valueType, valueText);
      const next: FlatTransitionCondition = {
        source: selectedField.source,
        path: [...selectedField.path],
        arrayAccesses: [...arrayAccesses],
        operator,
        ...(value !== undefined ? { value } : {}),
      };
      onChange(createFlatTransitionCondition([...existingConditions, next]));
      setSelectedField(null);
      setArrayAccesses([]);
      setValueText("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid value.");
    }
  }

  function removeCondition(index: number) {
    if (existingConditions === null) return;
    onChange(createFlatTransitionCondition(
      existingConditions.filter((_, conditionIndex) => conditionIndex !== index),
    ));
  }

  const requiresValue = operator !== "exists" && operator !== "does-not-exist";
  const arrayLevelCount = selectedField === null ? 0 : countArrayLevels(selectedField.path);

  return (
    <section className="transition-condition-editor">
      <div className="transition-condition-heading">
        <strong>Match ALL data conditions</strong>
        <span>{existingConditions?.length ?? 0} configured</span>
      </div>
      {existingConditions === null ? (
        <p className="transition-condition-warning">
          This predicate contains an advanced condition that the flat editor cannot modify. The condition is preserved.
        </p>
      ) : (
        <>
          {existingConditions.length > 0 && (
            <ol className="transition-condition-list">
              {existingConditions.map((item, index) => (
                <li key={`${item.source}-${JSON.stringify(item)}-${index}`}>
                  <code>{formatCondition(item)}</code>
                  <button type="button" onClick={() => removeCondition(index)} disabled={disabled}>Remove</button>
                </li>
              ))}
            </ol>
          )}
          <TransitionDataFieldPicker
            catalogue={catalogue}
            transitionName={transitionName}
            disabled={disabled}
            label="Condition field"
            selectedField={selectedField}
            onSelect={selectField}
          />
          {selectedField && (
            <div className="transition-condition-draft">
              {arrayAccesses.map((access, level) => (
                <div className="transition-array-level" key={level}>
                  <label>
                    Array level {level + 1} of {arrayLevelCount}
                    <select
                      value={access.mode}
                      onChange={(event) => updateArrayAccess(
                        level,
                        event.target.value === "indexed-item"
                          ? { mode: "indexed-item", index: 0 }
                          : { mode: "contains-item" },
                      )}
                      disabled={disabled}
                    >
                      <option value="contains-item">Contains an item matching</option>
                      <option value="indexed-item">Item at zero-based index</option>
                    </select>
                  </label>
                  {access.mode === "indexed-item" && (
                    <label>
                      Index for level {level + 1}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={access.index}
                        onChange={(event) => updateArrayAccess(level, {
                          mode: "indexed-item",
                          index: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                        })}
                        disabled={disabled}
                      />
                    </label>
                  )}
                </div>
              ))}
              <label>
                Operator
                <select value={operator} onChange={(event) => { setOperator(event.target.value as ComparisonOperator); setError(null); }} disabled={disabled}>
                  {OPERATORS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              {requiresValue && (
                <>
                  <label>
                    Type
                    <select value={valueType} onChange={(event) => { setValueType(event.target.value as ConditionValueType); setValueText(""); setError(null); }} disabled={disabled}>
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="null">null</option>
                    </select>
                  </label>
                  {valueType === "boolean" ? (
                    <label>
                      Value
                      <select value={valueText || "true"} onChange={(event) => setValueText(event.target.value)} disabled={disabled}>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                  ) : valueType !== "null" ? (
                    <label>
                      Value
                      <input type={valueType === "number" ? "number" : "text"} value={valueText} onChange={(event) => setValueText(event.target.value)} disabled={disabled} />
                    </label>
                  ) : null}
                </>
              )}
              <button type="button" onClick={addCondition} disabled={disabled}>Add condition</button>
            </div>
          )}
          {error && <p className="transition-condition-error">{error}</p>}
        </>
      )}
    </section>
  );
}
