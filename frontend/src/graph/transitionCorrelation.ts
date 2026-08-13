import {
  resolveDataPath,
  type ComparisonOperator,
  type DataPathSegment,
  type DataSource,
  type JsonValue,
  type TransitionData,
} from "./transitionConditions";

export type CaptureDefinition = {
  /** Stable identifier used by new alias references. Legacy captures may omit it. */
  id?: string;
  /** User-facing alias name. */
  alias: string;
  source: DataSource;
  path: DataPathSegment[];
};

export type ActivationBindings = Record<string, JsonValue>;

export type CaptureResult = {
  bindings: ActivationBindings;
  errors: string[];
};

export type CorrelationValueReference =
  | {
      kind: "literal";
      value: JsonValue;
    }
  | {
      kind: "activation";
      /** Stable capture ID for new documents. */
      aliasId?: string;
      /** Legacy/name-based reference retained for backward compatibility. */
      alias?: string;
    }
  | {
      kind: "target";
      source: DataSource;
      path: DataPathSegment[];
    }
  | {
      kind: "item";
      path: DataPathSegment[];
    };

export type CorrelationCondition =
  | {
      type: "comparison";
      left: CorrelationValueReference;
      operator: Exclude<ComparisonOperator, "exists" | "does-not-exist">;
      right: CorrelationValueReference;
    }
  | {
      type: "reference-exists";
      reference: CorrelationValueReference;
      exists: boolean;
    }
  | {
      type: "contains-item";
      source: DataSource;
      path: DataPathSegment[];
      condition: CorrelationCondition;
    }
  | {
      type: "group";
      operator: "and" | "or";
      conditions: CorrelationCondition[];
    };

export type CorrelationEvaluation = {
  matches: boolean;
  errors: string[];
};

export type CorrelationReferenceEvidence = {
  kind: CorrelationValueReference["kind"];
  label: string;
  alias?: string;
  path?: string;
  found: boolean;
  value?: unknown;
};

export type CorrelationComparisonEvidence = {
  operator: Extract<CorrelationCondition, { type: "comparison" }>["operator"];
  left: CorrelationReferenceEvidence;
  right: CorrelationReferenceEvidence;
  matches: boolean;
};

export type CorrelationExplanation = CorrelationEvaluation & {
  comparisons: CorrelationComparisonEvidence[];
};

type ResolvedReference = {
  found: boolean;
  value: unknown;
};

const ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

  if (
    typeof left === "object" &&
    left !== null &&
    !Array.isArray(left) &&
    typeof right === "object" &&
    right !== null &&
    !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(rightRecord, key) &&
          deepEqual(leftRecord[key], rightRecord[key]),
      )
    );
  }

  return false;
}

export function validateCaptureDefinitions(
  definitions: readonly CaptureDefinition[],
): string[] {
  const errors: string[] = [];
  const aliases = new Set<string>();
  const ids = new Set<string>();

  definitions.forEach((definition, index) => {
    const location = `captures[${index}]`;
    if (!ALIAS_PATTERN.test(definition.alias)) {
      errors.push(
        `${location}.alias must start with a letter or underscore and contain only letters, numbers, and underscores.`,
      );
    }
    if (aliases.has(definition.alias)) {
      errors.push(`Duplicate capture alias: $${definition.alias}.`);
    }
    aliases.add(definition.alias);
    if (definition.id !== undefined) {
      if (!ALIAS_PATTERN.test(definition.id)) {
        errors.push(
          `${location}.id must start with a letter or underscore and contain only letters, numbers, and underscores.`,
        );
      }
      if (ids.has(definition.id)) {
        errors.push(`Duplicate capture ID: ${definition.id}.`);
      }
      ids.add(definition.id);
    }
  });

  return errors;
}

export function captureActivationValues(
  definitions: readonly CaptureDefinition[],
  activation: TransitionData,
): CaptureResult {
  const errors = validateCaptureDefinitions(definitions);
  if (errors.length > 0) {
    return { bindings: {}, errors };
  }

  const bindings: ActivationBindings = {};
  definitions.forEach((definition) => {
    const resolved = resolveDataPath(
      activation[definition.source],
      definition.path,
    );
    if (!resolved.found) {
      errors.push(`Capture $${definition.alias} could not resolve its data path.`);
      return;
    }
    if (
      resolved.value !== null &&
      typeof resolved.value !== "string" &&
      typeof resolved.value !== "number" &&
      typeof resolved.value !== "boolean"
    ) {
      errors.push(`Capture $${definition.alias} must resolve to exactly one scalar value.`);
      return;
    }
    bindings[definition.id ?? definition.alias] = resolved.value;
  });

  return { bindings: errors.length === 0 ? bindings : {}, errors };
}

function validateReference(
  reference: CorrelationValueReference,
  availableAliases: ReadonlySet<string>,
  insideItem: boolean,
  location: string,
): string[] {
  if (reference.kind === "activation") {
    const key = reference.aliasId ?? reference.alias;
    if (!key) {
      return [`${location} must specify aliasId or legacy alias.`];
    }
    if (!availableAliases.has(key)) {
      return [`${location} references unknown activation variable $${key}.`];
    }
  }
  if (reference.kind === "item" && !insideItem) {
    return [`${location} uses an item reference outside contains-item.`];
  }
  return [];
}

function validateCorrelationConditionAt(
  condition: CorrelationCondition,
  availableAliases: ReadonlySet<string>,
  insideItem: boolean,
  location: string,
): string[] {
  switch (condition.type) {
    case "comparison":
      return [
        ...validateReference(
          condition.left,
          availableAliases,
          insideItem,
          `${location}.left`,
        ),
        ...validateReference(
          condition.right,
          availableAliases,
          insideItem,
          `${location}.right`,
        ),
      ];
    case "reference-exists":
      return validateReference(
        condition.reference,
        availableAliases,
        insideItem,
        `${location}.reference`,
      );
    case "contains-item":
      return validateCorrelationConditionAt(
        condition.condition,
        availableAliases,
        true,
        `${location}.condition`,
      );
    case "group":
      if (condition.conditions.length === 0) {
        return [`${location} must contain at least one condition.`];
      }
      return condition.conditions.flatMap((child, index) =>
        validateCorrelationConditionAt(
          child,
          availableAliases,
          insideItem,
          `${location}.conditions[${index}]`,
        ),
      );
  }
}

export function validateCorrelationCondition(
  condition: CorrelationCondition,
  availableAliases: Iterable<string>,
): string[] {
  return validateCorrelationConditionAt(
    condition,
    new Set(availableAliases),
    false,
    "correlation",
  );
}

function resolveReference(
  reference: CorrelationValueReference,
  target: TransitionData,
  bindings: ActivationBindings,
  item: unknown,
): ResolvedReference {
  switch (reference.kind) {
    case "literal":
      return { found: true, value: reference.value };
    case "activation": {
      const key = reference.aliasId ?? reference.alias;
      return key !== undefined && Object.prototype.hasOwnProperty.call(bindings, key)
        ? { found: true, value: bindings[key] }
        : { found: false, value: undefined };
    }
    case "target":
      return resolveDataPath(target[reference.source], reference.path);
    case "item":
      return resolveDataPath(item, reference.path);
  }
}

function evaluateComparison(
  operator: Extract<CorrelationCondition, { type: "comparison" }>["operator"],
  left: ResolvedReference,
  right: ResolvedReference,
): boolean {
  if (!left.found || !right.found) {
    return false;
  }

  if (operator === "=") {
    return deepEqual(left.value, right.value);
  }
  if (operator === "!=") {
    return !deepEqual(left.value, right.value);
  }
  if (typeof left.value !== "number" || typeof right.value !== "number") {
    return false;
  }

  switch (operator) {
    case "<":
      return left.value < right.value;
    case "<=":
      return left.value <= right.value;
    case ">":
      return left.value > right.value;
    case ">=":
      return left.value >= right.value;
  }
}

function evaluateCorrelationConditionAt(
  condition: CorrelationCondition,
  target: TransitionData,
  bindings: ActivationBindings,
  item: unknown,
): boolean {
  switch (condition.type) {
    case "comparison":
      return evaluateComparison(
        condition.operator,
        resolveReference(condition.left, target, bindings, item),
        resolveReference(condition.right, target, bindings, item),
      );
    case "reference-exists": {
      const resolved = resolveReference(
        condition.reference,
        target,
        bindings,
        item,
      );
      return condition.exists ? resolved.found : !resolved.found;
    }
    case "contains-item": {
      const resolved = resolveDataPath(target[condition.source], condition.path);
      return (
        resolved.found &&
        Array.isArray(resolved.value) &&
        resolved.value.some((candidate) =>
          evaluateCorrelationConditionAt(
            condition.condition,
            target,
            bindings,
            candidate,
          ),
        )
      );
    }
    case "group":
      return condition.operator === "and"
        ? condition.conditions.every((child) =>
            evaluateCorrelationConditionAt(child, target, bindings, item),
          )
        : condition.conditions.some((child) =>
            evaluateCorrelationConditionAt(child, target, bindings, item),
          );
  }
}

export function evaluateCorrelationCondition(
  condition: CorrelationCondition,
  target: TransitionData,
  bindings: ActivationBindings,
): CorrelationEvaluation {
  const errors = validateCorrelationCondition(condition, Object.keys(bindings));
  if (errors.length > 0) {
    return { matches: false, errors };
  }

  return {
    matches: evaluateCorrelationConditionAt(
      condition,
      target,
      bindings,
      undefined,
    ),
    errors: [],
  };
}


function formatEvidencePath(
  source: DataSource,
  path: readonly DataPathSegment[],
): string {
  let result = source;
  for (const segment of path) {
    if (segment === "[]") {
      result += "[]";
    } else if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += `.${segment}`;
    }
  }
  return result;
}

function referenceEvidence(
  reference: CorrelationValueReference,
  target: TransitionData,
  bindings: ActivationBindings,
  capturesByKey: ReadonlyMap<string, CaptureDefinition>,
  item: unknown,
): CorrelationReferenceEvidence {
  const resolved = resolveReference(reference, target, bindings, item);
  let label: string;
  switch (reference.kind) {
    case "literal":
      label = "literal";
      break;
    case "activation": {
      const key = reference.aliasId ?? reference.alias ?? "unknown";
      const capture = capturesByKey.get(key);
      label = capture
        ? `$${capture.alias} (${formatEvidencePath(capture.source, capture.path)})`
        : `$${reference.alias ?? reference.aliasId ?? "unknown"}`;
      break;
    }
    case "target":
      label = formatEvidencePath(reference.source, reference.path);
      break;
    case "item":
      label = `item${formatEvidencePath("inputs", reference.path).slice("inputs".length)}`;
      break;
  }
  const capture = reference.kind === "activation"
    ? capturesByKey.get(reference.aliasId ?? reference.alias ?? "")
    : undefined;
  const alias = reference.kind === "activation"
    ? capture?.alias ?? reference.alias ?? reference.aliasId
    : undefined;
  const path = capture
    ? formatEvidencePath(capture.source, capture.path)
    : reference.kind === "target"
      ? formatEvidencePath(reference.source, reference.path)
      : undefined;
  return {
    kind: reference.kind,
    label,
    ...(alias ? { alias } : {}),
    ...(path ? { path } : {}),
    found: resolved.found,
    ...(resolved.found ? { value: resolved.value } : {}),
  };
}

function explainCorrelationAt(
  condition: CorrelationCondition,
  target: TransitionData,
  bindings: ActivationBindings,
  capturesByKey: ReadonlyMap<string, CaptureDefinition>,
  item: unknown,
): CorrelationExplanation {
  switch (condition.type) {
    case "comparison": {
      const left = referenceEvidence(
        condition.left,
        target,
        bindings,
        capturesByKey,
        item,
      );
      const right = referenceEvidence(
        condition.right,
        target,
        bindings,
        capturesByKey,
        item,
      );
      const matches = evaluateComparison(
        condition.operator,
        { found: left.found, value: left.value },
        { found: right.found, value: right.value },
      );
      return {
        matches,
        errors: [],
        comparisons: [{ operator: condition.operator, left, right, matches }],
      };
    }
    case "reference-exists":
      return {
        matches: evaluateCorrelationConditionAt(condition, target, bindings, item),
        errors: [],
        comparisons: [],
      };
    case "contains-item": {
      const resolved = resolveDataPath(target[condition.source], condition.path);
      if (!resolved.found || !Array.isArray(resolved.value)) {
        return { matches: false, errors: [], comparisons: [] };
      }
      for (const candidate of resolved.value) {
        const explanation = explainCorrelationAt(
          condition.condition,
          target,
          bindings,
          capturesByKey,
          candidate,
        );
        if (explanation.matches) return explanation;
      }
      return { matches: false, errors: [], comparisons: [] };
    }
    case "group": {
      const children = condition.conditions.map((child) =>
        explainCorrelationAt(child, target, bindings, capturesByKey, item),
      );
      const matches = condition.operator === "and"
        ? children.every((child) => child.matches)
        : children.some((child) => child.matches);
      const contributingChildren = condition.operator === "or" && matches
        ? children.filter((child) => child.matches)
        : children;
      return {
        matches,
        errors: children.flatMap((child) => child.errors),
        comparisons: contributingChildren.flatMap((child) => child.comparisons),
      };
    }
  }
}

export function explainCorrelationCondition(
  condition: CorrelationCondition,
  target: TransitionData,
  bindings: ActivationBindings,
  captures: readonly CaptureDefinition[] = [],
): CorrelationExplanation {
  const errors = validateCorrelationCondition(condition, Object.keys(bindings));
  if (errors.length > 0) {
    return { matches: false, errors, comparisons: [] };
  }
  const capturesByKey = new Map<string, CaptureDefinition>();
  for (const capture of captures) {
    capturesByKey.set(capture.id ?? capture.alias, capture);
  }
  return explainCorrelationAt(
    condition,
    target,
    bindings,
    capturesByKey,
    undefined,
  );
}
