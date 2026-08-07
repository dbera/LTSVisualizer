import { useMemo, useState } from "react";

import TransitionDataFieldPicker from "./TransitionDataFieldPicker";
import type {
  ComparisonOperator,
  TransitionCondition,
} from "./transitionConditions";
import type {
  TransitionDataCatalogue,
  TransitionDataField,
} from "./transitionDataCatalogue";
import {
  createFlatTransitionCondition,
  inferConditionValueType,
  parseConditionValue,
  readFlatTransitionConditions,
  type ConditionValueType,
  type FlatTransitionCondition,
} from "./transitionConditionEditorModel";

const OPERATORS: readonly ComparisonOperator[] = [
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "exists",
  "does-not-exist",
];

type Props = {
  catalogue: TransitionDataCatalogue;
  transitionName: string;
  condition: TransitionCondition | undefined;
  disabled?: boolean;
  onChange: (condition: TransitionCondition | undefined) => void;
};

function formatValue(condition: FlatTransitionCondition): string {
  if (condition.operator === "exists") return "exists";
  if (condition.operator === "does-not-exist") return "does not exist";
  if (condition.value === null) return "null";
  return JSON.stringify(condition.value);
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
  const [selectedField, setSelectedField] =
    useState<TransitionDataField | null>(null);
  const [operator, setOperator] = useState<ComparisonOperator>("=");
  const [valueType, setValueType] =
    useState<ConditionValueType>("string");
  const [valueText, setValueText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectField(field: TransitionDataField) {
    setSelectedField(field);
    const inferredType = inferConditionValueType(field.valueTypes);
    setValueType(inferredType);
    setValueText(inferredType === "boolean" ? "true" : "");
    setError(null);
  }

  function addCondition() {
    if (!selectedField || existingConditions === null) return;

    try {
      const value =
        operator === "exists" || operator === "does-not-exist"
          ? undefined
          : parseConditionValue(valueType, valueText);
      const nextConditions = [
        ...existingConditions,
        {
          source: selectedField.source,
          path: [...selectedField.path],
          operator,
          ...(value !== undefined ? { value } : {}),
        },
      ];

      onChange(createFlatTransitionCondition(nextConditions));
      setSelectedField(null);
      setValueText("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid value.");
    }
  }

  function removeCondition(index: number) {
    if (existingConditions === null) return;
    onChange(
      createFlatTransitionCondition(
        existingConditions.filter((_, conditionIndex) => conditionIndex !== index),
      ),
    );
  }

  const requiresValue = operator !== "exists" && operator !== "does-not-exist";

  return (
    <section className="transition-condition-editor">
      <div className="transition-condition-heading">
        <strong>Match ALL data conditions</strong>
        <span>{existingConditions?.length ?? 0} configured</span>
      </div>

      {existingConditions === null ? (
        <p className="transition-condition-warning">
          This predicate contains an advanced condition that the flat editor
          cannot modify. The condition is preserved.
        </p>
      ) : (
        <>
          {existingConditions.length > 0 && (
            <ol className="transition-condition-list">
              {existingConditions.map((item, index) => (
                <li key={`${item.source}-${JSON.stringify(item.path)}-${index}`}>
                  <code>
                    {item.source}.{item.path.join(".")} {item.operator}{" "}
                    {formatValue(item)}
                  </code>
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    disabled={disabled}
                  >
                    Remove
                  </button>
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
              <label>
                Operator
                <select
                  value={operator}
                  onChange={(event) => {
                    setOperator(event.target.value as ComparisonOperator);
                    setError(null);
                  }}
                  disabled={disabled}
                >
                  {OPERATORS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              {requiresValue && (
                <>
                  <label>
                    Type
                    <select
                      value={valueType}
                      onChange={(event) => {
                        setValueType(event.target.value as ConditionValueType);
                        setValueText("");
                        setError(null);
                      }}
                      disabled={disabled}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="null">null</option>
                    </select>
                  </label>

                  {valueType === "boolean" ? (
                    <label>
                      Value
                      <select
                        value={valueText || "true"}
                        onChange={(event) => setValueText(event.target.value)}
                        disabled={disabled}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    </label>
                  ) : valueType !== "null" ? (
                    <label>
                      Value
                      <input
                        type={valueType === "number" ? "number" : "text"}
                        value={valueText}
                        onChange={(event) => setValueText(event.target.value)}
                        disabled={disabled}
                      />
                    </label>
                  ) : null}
                </>
              )}

              <button type="button" onClick={addCondition} disabled={disabled}>
                Add condition
              </button>
            </div>
          )}

          {error && <p className="transition-condition-error">{error}</p>}
        </>
      )}
    </section>
  );
}
