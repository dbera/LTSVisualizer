import type { DeclareConstraint } from "./declareConstraints";
import type { ComparisonOperator } from "./transitionConditions";
import TransitionDataFieldPicker from "./TransitionDataFieldPicker";
import type {
  CaptureDefinition,
  CorrelationCondition,
} from "./transitionCorrelation";
import type {
  TransitionDataCatalogue,
  TransitionDataField,
} from "./transitionDataCatalogue";

type Props = {
  constraint: DeclareConstraint;
  activationTransitionName: string;
  targetTransitionName: string;
  catalogue: TransitionDataCatalogue;
  disabled: boolean;
  onChange: (constraint: DeclareConstraint) => void;
};

const OPERATORS: readonly Exclude<
  ComparisonOperator,
  "exists" | "does-not-exist"
>[] = ["=", "!=", "<", "<=", ">", ">="];

function captures(constraint: DeclareConstraint): CaptureDefinition[] {
  return constraint.activation?.predicates[0]?.captures ?? [];
}

function stableKey(capture: CaptureDefinition): string {
  return capture.id ?? capture.alias;
}

function nextAliasId(existing: readonly CaptureDefinition[]): string {
  let sequence = existing.length + 1;
  while (existing.some((capture) => stableKey(capture) === `alias_${sequence}`)) {
    sequence += 1;
  }
  return `alias_${sequence}`;
}

function updateCaptures(
  constraint: DeclareConstraint,
  nextCaptures: CaptureDefinition[],
): DeclareConstraint {
  const activation = constraint.activation;
  if (!activation || activation.predicates.length === 0) return constraint;
  const first = activation.predicates[0];
  return {
    ...constraint,
    activation: {
      ...activation,
      predicates: [
        {
          ...first,
          ...(nextCaptures.length > 0 ? { captures: nextCaptures } : {}),
        },
        ...activation.predicates.slice(1),
      ],
    },
  };
}

function simpleCorrelation(
  condition: CorrelationCondition | undefined,
): Extract<CorrelationCondition, { type: "comparison" }> | null {
  if (
    condition?.type === "comparison" &&
    condition.left.kind === "target" &&
    condition.right.kind === "activation"
  ) {
    return condition;
  }
  return null;
}

function fieldFor(
  catalogue: TransitionDataCatalogue,
  transitionName: string,
  source: "inputs" | "outputs",
  path: readonly (string | number)[],
): TransitionDataField | null {
  const fields = catalogue.fieldsByTransition[transitionName] ?? catalogue.allFields;
  return fields.find(
    (field) =>
      field.source === source &&
      JSON.stringify(field.path) === JSON.stringify(path),
  ) ?? null;
}

function isScalarField(field: TransitionDataField): boolean {
  return field.valueTypes.every((type) =>
    type === "string" || type === "number" || type === "boolean" || type === "null"
  );
}

export default function CorrelationAliasEditor({
  constraint,
  activationTransitionName,
  targetTransitionName,
  catalogue,
  disabled,
  onChange,
}: Props) {
  const aliases = captures(constraint);
  const correlation = simpleCorrelation(constraint.correlation);

  function addAlias() {
    const id = nextAliasId(aliases);
    onChange(updateCaptures(constraint, [
      ...aliases,
      { id, alias: id, source: "inputs", path: [] },
    ]));
  }

  function changeAlias(index: number, change: Partial<CaptureDefinition>) {
    const next = aliases.map((capture, currentIndex) =>
      currentIndex === index ? { ...capture, ...change } : capture,
    );
    onChange(updateCaptures(constraint, next));
  }

  function removeAlias(index: number) {
    const removedKey = stableKey(aliases[index]);
    const nextConstraint = updateCaptures(
      constraint,
      aliases.filter((_, currentIndex) => currentIndex !== index),
    );
    const referencesRemoved =
      correlation?.right.kind === "activation" &&
      (correlation.right.aliasId ?? correlation.right.alias) === removedKey;
    onChange({
      ...nextConstraint,
      ...(referencesRemoved ? { correlation: undefined } : {}),
    });
  }

  function setSimpleCorrelation(
    field: TransitionDataField,
    aliasKey: string,
    operator: Exclude<ComparisonOperator, "exists" | "does-not-exist"> = "=",
  ) {
    onChange({
      ...constraint,
      correlation: {
        type: "comparison",
        left: { kind: "target", source: field.source, path: field.path },
        operator,
        right: { kind: "activation", aliasId: aliasKey },
      },
    });
  }

  const selectedTargetField = correlation?.left.kind === "target"
    ? fieldFor(
        catalogue,
        targetTransitionName,
        correlation.left.source,
        correlation.left.path,
      )
    : null;
  const selectedAliasKey = correlation?.right.kind === "activation"
    ? correlation.right.aliasId ?? correlation.right.alias ?? ""
    : "";

  return (
    <section className="correlation-alias-editor">
      <div className="correlation-alias-heading">
        <div>
          <strong>Correlation aliases</strong>
          <span>Bind scalar activation data and compare target data with it.</span>
        </div>
        <button type="button" onClick={addAlias} disabled={disabled}>
          Add alias
        </button>
      </div>

      {aliases.length === 0 ? (
        <p className="correlation-alias-empty">
          No aliases. Add one to correlate a target with activation data.
        </p>
      ) : (
        <div className="correlation-alias-list">
          {aliases.map((capture, index) => {
            const selected = fieldFor(
              catalogue,
              activationTransitionName,
              capture.source,
              capture.path,
            );
            return (
              <div className="correlation-alias-row" key={stableKey(capture)}>
                <label>
                  Alias name
                  <input
                    value={capture.alias}
                    disabled={disabled}
                    onChange={(event) =>
                      changeAlias(index, { alias: event.target.value })
                    }
                  />
                </label>
                <TransitionDataFieldPicker
                  catalogue={catalogue}
                  transitionName={activationTransitionName}
                  selectedField={selected}
                  disabled={disabled}
                  label="Activation source field"
                  onSelect={(field) => {
                    if (isScalarField(field)) {
                      changeAlias(index, { source: field.source, path: field.path });
                    }
                  }}
                />
                <button
                  type="button"
                  className="correlation-alias-remove"
                  onClick={() => removeAlias(index)}
                  disabled={disabled}
                >
                  Remove alias
                </button>
                {selected && !isScalarField(selected) && (
                  <p className="correlation-alias-warning">
                    Select a scalar field. Object and array aliases are not supported.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {aliases.length > 0 && (
        <div className="correlation-target-editor">
          <strong>Target matching condition</strong>
          {constraint.correlation && !correlation ? (
            <div className="correlation-complex-note">
              <p>
                This imported constraint uses an advanced correlation expression.
                The expression is preserved until replaced or cleared.
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...constraint, correlation: undefined })}
              >
                Clear advanced correlation
              </button>
            </div>
          ) : (
            <>
              <TransitionDataFieldPicker
                catalogue={catalogue}
                transitionName={targetTransitionName}
                selectedField={selectedTargetField}
                disabled={disabled}
                label="Target field"
                onSelect={(field) =>
                  setSimpleCorrelation(
                    field,
                    selectedAliasKey || stableKey(aliases[0]),
                    correlation?.operator ?? "=",
                  )
                }
              />
              <div className="correlation-target-controls">
                <label>
                  Operator
                  <select
                    disabled={disabled || !correlation}
                    value={correlation?.operator ?? "="}
                    onChange={(event) => {
                      if (selectedTargetField) {
                        setSimpleCorrelation(
                          selectedTargetField,
                          selectedAliasKey || stableKey(aliases[0]),
                          event.target.value as typeof OPERATORS[number],
                        );
                      }
                    }}
                  >
                    {OPERATORS.map((operator) => (
                      <option value={operator} key={operator}>{operator}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Activation alias
                  <select
                    disabled={disabled || !selectedTargetField}
                    value={selectedAliasKey || stableKey(aliases[0])}
                    onChange={(event) => {
                      if (selectedTargetField) {
                        setSimpleCorrelation(
                          selectedTargetField,
                          event.target.value,
                          correlation?.operator ?? "=",
                        );
                      }
                    }}
                  >
                    {aliases.map((capture) => (
                      <option value={stableKey(capture)} key={stableKey(capture)}>
                        {capture.alias}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={disabled || !constraint.correlation}
                  onClick={() => onChange({ ...constraint, correlation: undefined })}
                >
                  Clear match
                </button>
              </div>
              {correlation && selectedTargetField && (
                <p className="correlation-summary">
                  <code>{selectedTargetField.displayPath}</code> {correlation.operator}{" "}
                  activation alias <code>{aliases.find(
                    (capture) => stableKey(capture) === selectedAliasKey,
                  )?.alias ?? selectedAliasKey}</code>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
