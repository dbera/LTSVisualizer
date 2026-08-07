export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DataPathSegment = string | number;
export type DataSource = "inputs" | "outputs";
export type ComparisonOperator =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "exists"
  | "does-not-exist";

export type ValueCondition =
  | {
      type: "comparison";
      path: DataPathSegment[];
      operator: ComparisonOperator;
      value?: JsonValue;
    }
  | {
      type: "partial-object";
      path: DataPathSegment[];
      value: { [key: string]: JsonValue };
    }
  | {
      type: "contains-item";
      path: DataPathSegment[];
      condition: ValueCondition;
    }
  | {
      type: "group";
      operator: "and" | "or";
      conditions: ValueCondition[];
    };

export type TransitionCondition =
  | {
      type: "source";
      source: DataSource;
      condition: ValueCondition;
    }
  | {
      type: "group";
      operator: "and" | "or";
      conditions: TransitionCondition[];
    };

export type TransitionData = {
  inputs?: unknown;
  outputs?: unknown;
};

export type ConditionEvaluation = {
  matches: boolean;
  errors: string[];
};

type ResolvedValue = {
  found: boolean;
  value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveDataPath(
  root: unknown,
  path: readonly DataPathSegment[],
): ResolvedValue {
  let current = root;

  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) {
        return { found: false, value: undefined };
      }
      current = current[segment];
      continue;
    }

    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { found: false, value: undefined };
    }
    current = current[segment];
  }

  return { found: true, value: current };
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) &&
          deepEqual(left[key], right[key]),
      )
    );
  }

  return false;
}

export function matchesPartialObject(
  actual: unknown,
  expected: Record<string, JsonValue>,
): boolean {
  if (!isRecord(actual)) {
    return false;
  }

  return Object.entries(expected).every(([key, expectedValue]) => {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      return false;
    }

    const actualValue = actual[key];
    if (isRecord(expectedValue)) {
      return matchesPartialObject(actualValue, expectedValue as Record<string, JsonValue>);
    }

    return deepEqual(actualValue, expectedValue);
  });
}

function formatPath(path: readonly DataPathSegment[]): string {
  if (path.length === 0) {
    return "<root>";
  }

  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : segment,
    )
    .join(".")
    .replace(/\.\[/g, "[");
}

function validateValueCondition(condition: ValueCondition, location: string): string[] {
  if (condition.type === "group") {
    if (condition.conditions.length === 0) {
      return [`${location} must contain at least one condition.`];
    }
    return condition.conditions.flatMap((child, index) =>
      validateValueCondition(child, `${location}.conditions[${index}]`),
    );
  }

  if (condition.type === "contains-item") {
    return validateValueCondition(condition.condition, `${location}.condition`);
  }

  if (condition.type === "comparison") {
    const requiresValue = !["exists", "does-not-exist"].includes(
      condition.operator,
    );
    if (requiresValue && condition.value === undefined) {
      return [`${location} requires a comparison value.`];
    }
    if (!requiresValue && condition.value !== undefined) {
      return [`${location} must not define a value for ${condition.operator}.`];
    }
  }

  return [];
}

export function validateTransitionCondition(
  condition: TransitionCondition,
): string[] {
  if (condition.type === "group") {
    if (condition.conditions.length === 0) {
      return ["The transition condition group must contain at least one condition."];
    }
    return condition.conditions.flatMap((child, index) =>
      validateTransitionConditionAt(child, `conditions[${index}]`),
    );
  }

  return validateValueCondition(condition.condition, condition.source);
}

function validateTransitionConditionAt(
  condition: TransitionCondition,
  location: string,
): string[] {
  if (condition.type === "group") {
    if (condition.conditions.length === 0) {
      return [`${location} must contain at least one condition.`];
    }
    return condition.conditions.flatMap((child, index) =>
      validateTransitionConditionAt(child, `${location}.conditions[${index}]`),
    );
  }

  return validateValueCondition(
    condition.condition,
    `${location}.${condition.source}`,
  );
}

function evaluateComparison(
  condition: Extract<ValueCondition, { type: "comparison" }>,
  root: unknown,
): boolean {
  const resolved = resolveDataPath(root, condition.path);

  if (condition.operator === "exists") {
    return resolved.found;
  }
  if (condition.operator === "does-not-exist") {
    return !resolved.found;
  }
  if (!resolved.found) {
    return false;
  }

  if (condition.operator === "=") {
    return deepEqual(resolved.value, condition.value);
  }
  if (condition.operator === "!=") {
    return !deepEqual(resolved.value, condition.value);
  }

  if (typeof resolved.value !== "number" || typeof condition.value !== "number") {
    return false;
  }

  switch (condition.operator) {
    case "<":
      return resolved.value < condition.value;
    case "<=":
      return resolved.value <= condition.value;
    case ">":
      return resolved.value > condition.value;
    case ">=":
      return resolved.value >= condition.value;
  }
}

function evaluateValueCondition(condition: ValueCondition, root: unknown): boolean {
  switch (condition.type) {
    case "comparison":
      return evaluateComparison(condition, root);
    case "partial-object": {
      const resolved = resolveDataPath(root, condition.path);
      return resolved.found && matchesPartialObject(resolved.value, condition.value);
    }
    case "contains-item": {
      const resolved = resolveDataPath(root, condition.path);
      return (
        resolved.found &&
        Array.isArray(resolved.value) &&
        resolved.value.some((item) => evaluateValueCondition(condition.condition, item))
      );
    }
    case "group":
      return condition.operator === "and"
        ? condition.conditions.every((child) => evaluateValueCondition(child, root))
        : condition.conditions.some((child) => evaluateValueCondition(child, root));
  }
}

function evaluateValidatedTransitionCondition(
  condition: TransitionCondition,
  transition: TransitionData,
): boolean {
  if (condition.type === "source") {
    return evaluateValueCondition(condition.condition, transition[condition.source]);
  }

  return condition.operator === "and"
    ? condition.conditions.every((child) =>
        evaluateValidatedTransitionCondition(child, transition),
      )
    : condition.conditions.some((child) =>
        evaluateValidatedTransitionCondition(child, transition),
      );
}

export function evaluateTransitionCondition(
  condition: TransitionCondition,
  transition: TransitionData,
): ConditionEvaluation {
  const errors = validateTransitionCondition(condition);
  if (errors.length > 0) {
    return { matches: false, errors };
  }

  return {
    matches: evaluateValidatedTransitionCondition(condition, transition),
    errors: [],
  };
}

export function describeDataPath(
  source: DataSource,
  path: readonly DataPathSegment[],
): string {
  return `${source}.${formatPath(path)}`;
}
