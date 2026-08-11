import {
  DECLARE_TEMPLATE_DEFINITIONS,
  getDeclareTemplateDefinition,
  type DeclareConstraint,
  type DeclarePredicateGroup,
  type DeclarePredicateRole,
  type DeclareTemplateId,
} from "./declareConstraints";
import { validateExecutableDeclareConstraint } from "./declareMonitorFactory";
import TransitionPicker from "./TransitionPicker";
import TransitionConditionEditor from "./TransitionConditionEditor";
import type { TransitionOption } from "./transitionCatalog";
import type { TransitionDataCatalogue } from "./transitionDataCatalogue";

type Props = {
  constraints: DeclareConstraint[];
  disabled: boolean;
  transitionOptions: readonly TransitionOption[];
  transitionDataCatalogue: TransitionDataCatalogue;
  onChange: (constraints: DeclareConstraint[]) => void;
};

function group(value = ""): DeclarePredicateGroup {
  return {
    relation: "or",
    predicates: [{ transition: { operator: "equals", value } }],
  };
}

function transitionValue(
  constraint: DeclareConstraint,
  role: DeclarePredicateRole,
): string {
  return constraint[role]?.predicates[0]?.transition?.value ?? "";
}

function transitionCondition(
  constraint: DeclareConstraint,
  role: DeclarePredicateRole,
) {
  return constraint[role]?.predicates[0]?.condition;
}

export default function DeclareConstraintBuilder({
  constraints,
  disabled,
  transitionOptions,
  transitionDataCatalogue,
  onChange,
}: Props) {
  function update(
    id: string,
    change: (constraint: DeclareConstraint) => DeclareConstraint,
  ) {
    onChange(
      constraints.map((constraint) =>
        constraint.id === id ? change(constraint) : constraint,
      ),
    );
  }

  function add() {
    let sequence = constraints.length + 1;
    while (constraints.some((constraint) => constraint.id === `constraint-${sequence}`)) {
      sequence += 1;
    }
    onChange([
      ...constraints,
      {
        id: `constraint-${sequence}`,
        template: "response",
        enabled: true,
        activation: group(),
        target: group(),
      },
    ]);
  }

  function changeTemplate(id: string, template: DeclareTemplateId) {
    update(id, (constraint) => {
      const definition = getDeclareTemplateDefinition(template);
      return {
        id: constraint.id,
        template,
        enabled: constraint.enabled,
        activation: constraint.activation ?? group(),
        target: definition.requiredRoles.includes("target")
          ? constraint.target ?? group()
          : undefined,
        count: definition.supportsCount ? constraint.count ?? 1 : undefined,
      };
    });
  }

  function changeTransition(
    id: string,
    role: DeclarePredicateRole,
    value: string,
  ) {
    update(id, (constraint) => {
      const currentGroup = constraint[role] ?? group();
      const currentPredicate = currentGroup.predicates[0] ?? {};

      return {
        ...constraint,
        [role]: {
          ...currentGroup,
          predicates: [
            {
              ...currentPredicate,
              transition: { operator: "equals", value },
            },
            ...currentGroup.predicates.slice(1),
          ],
        },
      };
    });
  }

  function changeCondition(
    id: string,
    role: DeclarePredicateRole,
    condition: import("./transitionConditions").TransitionCondition | undefined,
  ) {
    update(id, (constraint) => {
      const currentGroup = constraint[role] ?? group();
      const currentPredicate = currentGroup.predicates[0] ?? {};
      const nextPredicate = { ...currentPredicate };

      if (condition === undefined) {
        delete nextPredicate.condition;
      } else {
        nextPredicate.condition = condition;
      }

      return {
        ...constraint,
        [role]: {
          ...currentGroup,
          predicates: [nextPredicate, ...currentGroup.predicates.slice(1)],
        },
      };
    });
  }

  return (
    <section className="declare-builder" aria-label="Declare constraints">
      <div className="declare-builder-heading">
        <div>
          <strong>Declare constraints</strong>
          <span>{constraints.length} configured</span>
        </div>
        <button type="button" onClick={add} disabled={disabled}>
          Add constraint
        </button>
      </div>
      {constraints.length === 0 ? (
        <p className="declare-empty">
          No constraints. All bounded paths are eligible.
        </p>
      ) : (
        <div className="declare-constraint-list">
          {constraints.map((constraint) => {
            const definition = getDeclareTemplateDefinition(constraint.template);
            const errors = validateExecutableDeclareConstraint(constraint);
            return (
              <article
                key={constraint.id}
                className={
                  constraint.enabled && errors.length > 0
                    ? "declare-constraint-card invalid"
                    : "declare-constraint-card"
                }
              >
                <div className="declare-constraint-toolbar">
                  <label>
                    <input
                      type="checkbox"
                      checked={constraint.enabled}
                      onChange={(event) =>
                        update(constraint.id, (current) => ({
                          ...current,
                          enabled: event.target.checked,
                        }))
                      }
                      disabled={disabled}
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        constraints.filter(
                          (candidate) => candidate.id !== constraint.id,
                        ),
                      )
                    }
                    disabled={disabled}
                  >
                    Remove
                  </button>
                </div>
                <label>
                  Template
                  <select
                    value={constraint.template}
                    onChange={(event) =>
                      changeTemplate(
                        constraint.id,
                        event.target.value as DeclareTemplateId,
                      )
                    }
                    disabled={disabled}
                  >
                    {DECLARE_TEMPLATE_DEFINITIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <TransitionPicker
                  label="Activation transition"
                  value={transitionValue(constraint, "activation")}
                  options={transitionOptions}
                  disabled={disabled}
                  onChange={(value) =>
                    changeTransition(constraint.id, "activation", value)
                  }
                />
                <TransitionConditionEditor
                  catalogue={transitionDataCatalogue}
                  transitionName={transitionValue(constraint, "activation")}
                  condition={transitionCondition(constraint, "activation")}
                  disabled={disabled}
                  onChange={(condition) =>
                    changeCondition(constraint.id, "activation", condition)
                  }
                />
                {definition.requiredRoles.includes("target") && (
                  <>
                    <TransitionPicker
                      label="Target transition"
                      value={transitionValue(constraint, "target")}
                      options={transitionOptions}
                      disabled={disabled}
                      onChange={(value) =>
                        changeTransition(constraint.id, "target", value)
                      }
                    />
                    <TransitionConditionEditor
                  catalogue={transitionDataCatalogue}
                  transitionName={transitionValue(constraint, "target")}
                  condition={transitionCondition(constraint, "target")}
                  disabled={disabled}
                  onChange={(condition) =>
                    changeCondition(constraint.id, "target", condition)
                  }
                />
                  </>
                )}
                {definition.supportsCount && (
                  <label>
                    Count N
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={constraint.count ?? 1}
                      onChange={(event) =>
                        update(constraint.id, (current) => ({
                          ...current,
                          count: Math.max(
                            0,
                            Number.parseInt(event.target.value, 10) || 0,
                          ),
                        }))
                      }
                      disabled={disabled}
                    />
                  </label>
                )}
                <p className="declare-description">{definition.description}</p>
                {constraint.enabled && errors.length > 0 && (
                  <ul className="declare-errors">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
