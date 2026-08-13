import type { DeclareConstraint } from "./declareConstraints";
import type { ComparisonOperator, DataPathSegment } from "./transitionConditions";
import TransitionDataFieldPicker from "./TransitionDataFieldPicker";
import FixedIndexTraversalEditor from "./FixedIndexTraversalEditor";
import {
  catalogueDataPath,
  concretizeDataPath,
  formatConcreteDataPath,
} from "./fixedIndexTraversalModel";
import type {
  CaptureDefinition,
  CorrelationCondition,
} from "./transitionCorrelation";
import type {
  TransitionDataCatalogue,
  TransitionDataField,
} from "./transitionDataCatalogue";
import "./CorrelationTargetMatches.css";

type Props = {
  constraint: DeclareConstraint;
  activationTransitionName: string;
  targetTransitionName: string;
  catalogue: TransitionDataCatalogue;
  disabled: boolean;
  onChange: (constraint: DeclareConstraint) => void;
};

type Comparison = Extract<CorrelationCondition, { type: "comparison" }>;
type Operator = Exclude<ComparisonOperator, "exists" | "does-not-exist">;

const OPERATORS: readonly Operator[] = ["=", "!=", "<", "<=", ">", ">="];

function captures(constraint: DeclareConstraint): CaptureDefinition[] {
  return constraint.activation?.predicates[0]?.captures ?? [];
}

function stableKey(capture: CaptureDefinition): string {
  return capture.id ?? capture.alias;
}

function nextAliasId(existing: readonly CaptureDefinition[]): string {
  let sequence = existing.length + 1;
  while (existing.some((capture) => stableKey(capture) === `alias_${sequence}`)) sequence += 1;
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
          ...(nextCaptures.length > 0 ? { captures: nextCaptures } : { captures: undefined }),
        },
        ...activation.predicates.slice(1),
      ],
    },
  };
}

function isEditableComparison(condition: CorrelationCondition): condition is Comparison {
  return condition.type === "comparison" &&
    condition.left.kind === "target" &&
    condition.right.kind === "activation";
}

function comparisons(condition: CorrelationCondition | undefined): Comparison[] | null {
  if (!condition) return [];
  if (isEditableComparison(condition)) return [condition];
  if (condition.type === "group" && condition.operator === "and" && condition.conditions.every(isEditableComparison)) {
    return condition.conditions;
  }
  return null;
}

function buildCorrelation(matches: readonly Comparison[]): CorrelationCondition | undefined {
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return { type: "group", operator: "and", conditions: [...matches] };
}

function availableFields(
  catalogue: TransitionDataCatalogue,
  transitionName: string,
): TransitionDataField[] {
  return catalogue.fieldsByTransition[transitionName] ?? catalogue.allFields;
}

function fieldFor(
  catalogue: TransitionDataCatalogue,
  transitionName: string,
  source: "inputs" | "outputs",
  path: readonly DataPathSegment[],
): TransitionDataField | null {
  const cataloguePath = catalogueDataPath(path);
  return availableFields(catalogue, transitionName).find(
    (field) => field.source === source && JSON.stringify(field.path) === JSON.stringify(cataloguePath),
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
  const matches = comparisons(constraint.correlation);

  function emitMatches(nextMatches: Comparison[]) {
    onChange({ ...constraint, correlation: buildCorrelation(nextMatches) });
  }

  function addAlias() {
    const id = nextAliasId(aliases);
    onChange(updateCaptures(constraint, [
      ...aliases,
      { id, alias: id, source: "inputs", path: [] },
    ]));
  }

  function changeAlias(index: number, change: Partial<CaptureDefinition>) {
    onChange(updateCaptures(
      constraint,
      aliases.map((capture, currentIndex) => currentIndex === index ? { ...capture, ...change } : capture),
    ));
  }

  function removeAlias(index: number) {
    const removedKey = stableKey(aliases[index]);
    const nextConstraint = updateCaptures(
      constraint,
      aliases.filter((_, currentIndex) => currentIndex !== index),
    );
    const nextMatches = (matches ?? []).filter((match) =>
      match.right.kind !== "activation" ||
      (match.right.aliasId ?? match.right.alias) !== removedKey
    );
    onChange({ ...nextConstraint, correlation: buildCorrelation(nextMatches) });
  }

  function updateMatch(index: number, next: Comparison) {
    if (!matches) return;
    emitMatches(matches.map((match, currentIndex) => currentIndex === index ? next : match));
  }

  function addMatch() {
    if (!matches || aliases.length === 0) return;
    const initialField = availableFields(catalogue, targetTransitionName).find(isScalarField);
    if (!initialField) return;
    emitMatches([
      ...matches,
      {
        type: "comparison",
        left: {
          kind: "target",
          source: initialField.source,
          path: concretizeDataPath(initialField.path),
        },
        operator: "=",
        right: { kind: "activation", aliasId: stableKey(aliases[0]) },
      },
    ]);
  }

  return (
    <section className="correlation-alias-editor">
      <div className="correlation-alias-heading">
        <div>
          <strong>Correlation aliases</strong>
          <span>Capture scalar activation values and require one or more target matches.</span>
        </div>
        <button type="button" disabled={disabled} onClick={addAlias}>Add alias</button>
      </div>

      {aliases.length === 0 ? (
        <p className="correlation-alias-empty">No aliases. Add one to correlate target data with activation data.</p>
      ) : (
        <div className="correlation-alias-list">
          {aliases.map((capture, index) => {
            const selectedField = fieldFor(
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
                    disabled={disabled}
                    value={capture.alias}
                    onChange={(event) => changeAlias(index, { alias: event.target.value })}
                  />
                </label>
                <TransitionDataFieldPicker
                  catalogue={catalogue}
                  transitionName={activationTransitionName}
                  disabled={disabled}
                  label="Activation source field"
                  selectedField={selectedField}
                  onSelect={(field) => {
                    if (isScalarField(field)) {
                      changeAlias(index, {
                        source: field.source,
                        path: concretizeDataPath(field.path),
                      });
                    }
                  }}
                />
                {selectedField && (
                  <FixedIndexTraversalEditor
                    disabled={disabled}
                    path={capture.path}
                    onChange={(path) => changeAlias(index, { path })}
                  />
                )}
                {selectedField && (
                  <p className="correlation-summary">
                    Selected scalar path: <code>{formatConcreteDataPath(capture.source, capture.path)}</code>
                  </p>
                )}
                <button
                  type="button"
                  className="correlation-alias-remove"
                  disabled={disabled}
                  onClick={() => removeAlias(index)}
                >
                  Remove alias
                </button>
              </div>
            );
          })}
        </div>
      )}

      {aliases.length > 0 && (
        <div className="correlation-target-editor">
          <div className="correlation-target-heading">
            <div>
              <strong>Target matching conditions</strong>
              <span>{matches?.length ?? 0} configured · Match ALL conditions</span>
            </div>
            <button
              type="button"
              disabled={disabled || matches === null || availableFields(catalogue, targetTransitionName).filter(isScalarField).length === 0}
              onClick={addMatch}
            >
              Add target match
            </button>
          </div>

          {matches === null ? (
            <div className="correlation-complex-note">
              <p>This correlation uses an advanced expression that this visual editor cannot modify.</p>
              <button type="button" disabled={disabled} onClick={() => onChange({ ...constraint, correlation: undefined })}>
                Replace with visual target matches
              </button>
            </div>
          ) : matches.length === 0 ? (
            <p className="correlation-alias-empty">No target matches. Add one for each activation alias that the target must match.</p>
          ) : (
            <div className="correlation-target-match-list">
              {matches.map((match, index) => {
                const target = match.left.kind === "target" ? match.left : null;
                const selectedField = target
                  ? fieldFor(catalogue, targetTransitionName, target.source, target.path)
                  : null;
                const selectedAliasKey = match.right.kind === "activation"
                  ? match.right.aliasId ?? match.right.alias ?? ""
                  : "";
                const selectedAlias = aliases.find((alias) => stableKey(alias) === selectedAliasKey);
                return (
                  <article className="correlation-target-match" key={index}>
                    <div className="correlation-target-match-heading">
                      <strong>Target match {index + 1}</strong>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => emitMatches(matches.filter((_, currentIndex) => currentIndex !== index))}
                      >
                        Remove match
                      </button>
                    </div>
                    <TransitionDataFieldPicker
                      catalogue={catalogue}
                      transitionName={targetTransitionName}
                      disabled={disabled}
                      label="Target field"
                      selectedField={selectedField}
                      onSelect={(field) => {
                        if (isScalarField(field)) {
                          updateMatch(index, {
                            ...match,
                            left: {
                              kind: "target",
                              source: field.source,
                              path: concretizeDataPath(field.path),
                            },
                          });
                        }
                      }}
                    />
                    {target && selectedField && (
                      <FixedIndexTraversalEditor
                        disabled={disabled}
                        path={target.path}
                        onChange={(path) => updateMatch(index, {
                          ...match,
                          left: { ...target, path },
                        })}
                      />
                    )}
                    <div className="correlation-target-controls">
                      <label>
                        Operator
                        <select
                          disabled={disabled}
                          value={match.operator}
                          onChange={(event) => updateMatch(index, {
                            ...match,
                            operator: event.target.value as Operator,
                          })}
                        >
                          {OPERATORS.map((operator) => <option value={operator} key={operator}>{operator}</option>)}
                        </select>
                      </label>
                      <label>
                        Activation alias
                        <select
                          disabled={disabled}
                          value={selectedAliasKey}
                          onChange={(event) => updateMatch(index, {
                            ...match,
                            right: { kind: "activation", aliasId: event.target.value },
                          })}
                        >
                          {aliases.map((alias) => (
                            <option value={stableKey(alias)} key={stableKey(alias)}>{alias.alias}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {target && selectedAlias && (
                      <p className="correlation-summary">
                        <code>{formatConcreteDataPath(target.source, target.path)}</code>{" "}
                        {match.operator} activation alias <code>{selectedAlias.alias}</code>
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
