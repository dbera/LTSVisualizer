import {
  DECLARE_TEMPLATE_DEFINITIONS,
  type ActivityRelation,
  type DeclareConstraint,
  type DeclarePredicate,
  type DeclarePredicateGroup,
  type DeclareTemplateId,
  type TransitionNameMatcher,
} from "./declareConstraints";
import type {
  ComparisonOperator,
  DataPathSegment,
  DataSource,
  JsonValue,
  TransitionCondition,
  ValueCondition,
} from "./transitionConditions";
import type {
  CaptureDefinition,
  CorrelationCondition,
  CorrelationValueReference,
} from "./transitionCorrelation";

export class DeclareConstraintJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeclareConstraintJsonError";
  }
}

type JsonObject = Record<string, unknown>;

const TEMPLATE_IDS = new Set<string>(
  DECLARE_TEMPLATE_DEFINITIONS.map((definition) => definition.id),
);
const COMPARISON_OPERATORS = new Set<string>([
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
  "exists",
  "does-not-exist",
]);
const CORRELATION_COMPARISON_OPERATORS = new Set<string>([
  "=",
  "!=",
  "<",
  "<=",
  ">",
  ">=",
]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, location: string): JsonObject {
  if (!isObject(value)) {
    throw new DeclareConstraintJsonError(`${location} must be a JSON object.`);
  }
  return value;
}

function requireArray(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DeclareConstraintJsonError(`${location} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, location: string): string {
  if (typeof value !== "string") {
    throw new DeclareConstraintJsonError(`${location} must be a string.`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, location: string): string {
  const result = requireString(value, location);
  if (result.length === 0) {
    throw new DeclareConstraintJsonError(`${location} must not be empty.`);
  }
  return result;
}

function requireBoolean(value: unknown, location: string): boolean {
  if (typeof value !== "boolean") {
    throw new DeclareConstraintJsonError(`${location} must be a boolean.`);
  }
  return value;
}

function parseAndOr(value: unknown, location: string): "and" | "or" {
  if (value !== "and" && value !== "or") {
    throw new DeclareConstraintJsonError(`${location} must be "and" or "or".`);
  }
  return value;
}

function parseDataSource(value: unknown, location: string): DataSource {
  if (value !== "inputs" && value !== "outputs") {
    throw new DeclareConstraintJsonError(
      `${location} must be "inputs" or "outputs".`,
    );
  }
  return value;
}

function parseDataPath(value: unknown, location: string): DataPathSegment[] {
  return requireArray(value, location).map((segment, index) => {
    if (typeof segment === "string") return segment;
    if (typeof segment === "number" && Number.isInteger(segment) && segment >= 0) {
      return segment;
    }
    throw new DeclareConstraintJsonError(
      `${location}[${index}] must be a string or a non-negative integer.`,
    );
  });
}

function parseJsonValue(value: unknown, location: string): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DeclareConstraintJsonError(`${location} must be a finite number.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => parseJsonValue(item, `${location}[${index}]`));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        parseJsonValue(item, `${location}.${key}`),
      ]),
    );
  }
  throw new DeclareConstraintJsonError(`${location} must contain JSON data.`);
}

function parseJsonObjectValue(
  value: unknown,
  location: string,
): { [key: string]: JsonValue } {
  const object = requireObject(value, location);
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [
      key,
      parseJsonValue(item, `${location}.${key}`),
    ]),
  );
}

function parseComparisonOperator(
  value: unknown,
  location: string,
): ComparisonOperator {
  if (typeof value !== "string" || !COMPARISON_OPERATORS.has(value)) {
    throw new DeclareConstraintJsonError(
      `${location} must be a supported comparison operator.`,
    );
  }
  return value as ComparisonOperator;
}

function parseValueCondition(value: unknown, location: string): ValueCondition {
  const condition = requireObject(value, location);
  switch (condition.type) {
    case "comparison": {
      const operator = parseComparisonOperator(
        condition.operator,
        `${location}.operator`,
      );
      const requiresValue = operator !== "exists" && operator !== "does-not-exist";
      if (requiresValue && condition.value === undefined) {
        throw new DeclareConstraintJsonError(
          `${location}.value is required for operator "${operator}".`,
        );
      }
      if (!requiresValue && condition.value !== undefined) {
        throw new DeclareConstraintJsonError(
          `${location}.value must be omitted for operator "${operator}".`,
        );
      }
      return {
        type: "comparison",
        path: parseDataPath(condition.path, `${location}.path`),
        operator,
        ...(requiresValue
          ? { value: parseJsonValue(condition.value, `${location}.value`) }
          : {}),
      };
    }
    case "partial-object":
      return {
        type: "partial-object",
        path: parseDataPath(condition.path, `${location}.path`),
        value: parseJsonObjectValue(condition.value, `${location}.value`),
      };
    case "contains-item":
      return {
        type: "contains-item",
        path: parseDataPath(condition.path, `${location}.path`),
        condition: parseValueCondition(
          condition.condition,
          `${location}.condition`,
        ),
      };
    case "group":
      return {
        type: "group",
        operator: parseAndOr(condition.operator, `${location}.operator`),
        conditions: requireArray(condition.conditions, `${location}.conditions`).map(
          (child, index) =>
            parseValueCondition(child, `${location}.conditions[${index}]`),
        ),
      };
    default:
      throw new DeclareConstraintJsonError(
        `${location}.type must be "comparison", "partial-object", "contains-item", or "group".`,
      );
  }
}

function parseTransitionCondition(
  value: unknown,
  location: string,
): TransitionCondition {
  const condition = requireObject(value, location);
  switch (condition.type) {
    case "source":
      return {
        type: "source",
        source: parseDataSource(condition.source, `${location}.source`),
        condition: parseValueCondition(condition.condition, `${location}.condition`),
      };
    case "group":
      return {
        type: "group",
        operator: parseAndOr(condition.operator, `${location}.operator`),
        conditions: requireArray(condition.conditions, `${location}.conditions`).map(
          (child, index) =>
            parseTransitionCondition(child, `${location}.conditions[${index}]`),
        ),
      };
    default:
      throw new DeclareConstraintJsonError(
        `${location}.type must be "source" or "group".`,
      );
  }
}

function parseCaptureDefinition(
  value: unknown,
  location: string,
): CaptureDefinition {
  const capture = requireObject(value, location);
  return {
    alias: requireString(capture.alias, `${location}.alias`),
    source: parseDataSource(capture.source, `${location}.source`),
    path: parseDataPath(capture.path, `${location}.path`),
  };
}

function parseCorrelationReference(
  value: unknown,
  location: string,
): CorrelationValueReference {
  const reference = requireObject(value, location);
  switch (reference.kind) {
    case "literal":
      return {
        kind: "literal",
        value: parseJsonValue(reference.value, `${location}.value`),
      };
    case "activation":
      return {
        kind: "activation",
        alias: requireString(reference.alias, `${location}.alias`),
      };
    case "target":
      return {
        kind: "target",
        source: parseDataSource(reference.source, `${location}.source`),
        path: parseDataPath(reference.path, `${location}.path`),
      };
    case "item":
      return {
        kind: "item",
        path: parseDataPath(reference.path, `${location}.path`),
      };
    default:
      throw new DeclareConstraintJsonError(
        `${location}.kind must be "literal", "activation", "target", or "item".`,
      );
  }
}

function parseCorrelationCondition(
  value: unknown,
  location: string,
): CorrelationCondition {
  const condition = requireObject(value, location);
  switch (condition.type) {
    case "comparison": {
      if (
        typeof condition.operator !== "string" ||
        !CORRELATION_COMPARISON_OPERATORS.has(condition.operator)
      ) {
        throw new DeclareConstraintJsonError(
          `${location}.operator must be a supported correlation comparison operator.`,
        );
      }
      return {
        type: "comparison",
        left: parseCorrelationReference(condition.left, `${location}.left`),
        operator: condition.operator as Extract<
          CorrelationCondition,
          { type: "comparison" }
        >["operator"],
        right: parseCorrelationReference(condition.right, `${location}.right`),
      };
    }
    case "reference-exists":
      return {
        type: "reference-exists",
        reference: parseCorrelationReference(
          condition.reference,
          `${location}.reference`,
        ),
        exists: requireBoolean(condition.exists, `${location}.exists`),
      };
    case "contains-item":
      return {
        type: "contains-item",
        source: parseDataSource(condition.source, `${location}.source`),
        path: parseDataPath(condition.path, `${location}.path`),
        condition: parseCorrelationCondition(
          condition.condition,
          `${location}.condition`,
        ),
      };
    case "group":
      return {
        type: "group",
        operator: parseAndOr(condition.operator, `${location}.operator`),
        conditions: requireArray(condition.conditions, `${location}.conditions`).map(
          (child, index) =>
            parseCorrelationCondition(child, `${location}.conditions[${index}]`),
        ),
      };
    default:
      throw new DeclareConstraintJsonError(
        `${location}.type must be "comparison", "reference-exists", "contains-item", or "group".`,
      );
  }
}

function parseTransitionMatcher(
  value: unknown,
  location: string,
): TransitionNameMatcher {
  const matcher = requireObject(value, location);
  if (matcher.operator !== "equals") {
    throw new DeclareConstraintJsonError(
      `${location}.operator must be "equals".`,
    );
  }
  return {
    operator: "equals",
    value: requireString(matcher.value, `${location}.value`),
  };
}

function parsePredicate(value: unknown, location: string): DeclarePredicate {
  const predicate = requireObject(value, location);
  return {
    ...(predicate.transition !== undefined
      ? {
          transition: parseTransitionMatcher(
            predicate.transition,
            `${location}.transition`,
          ),
        }
      : {}),
    ...(predicate.condition !== undefined
      ? {
          condition: parseTransitionCondition(
            predicate.condition,
            `${location}.condition`,
          ),
        }
      : {}),
    ...(predicate.captures !== undefined
      ? {
          captures: requireArray(
            predicate.captures,
            `${location}.captures`,
          ).map((capture, index) =>
            parseCaptureDefinition(capture, `${location}.captures[${index}]`),
          ),
        }
      : {}),
  };
}

function parsePredicateGroup(
  value: unknown,
  location: string,
): DeclarePredicateGroup {
  const group = requireObject(value, location);
  return {
    relation: parseAndOr(group.relation, `${location}.relation`) as ActivityRelation,
    predicates: requireArray(group.predicates, `${location}.predicates`).map(
      (predicate, index) =>
        parsePredicate(predicate, `${location}.predicates[${index}]`),
    ),
  };
}

function parseTemplateId(value: unknown, location: string): DeclareTemplateId {
  const template = requireString(value, location);
  if (!TEMPLATE_IDS.has(template)) {
    throw new DeclareConstraintJsonError(
      `${location} contains unknown Declare template "${template}".`,
    );
  }
  return template as DeclareTemplateId;
}

function parseDeclareConstraint(
  value: unknown,
  location: string,
): DeclareConstraint {
  const constraint = requireObject(value, location);
  const count = constraint.count;
  if (
    count !== undefined &&
    (typeof count !== "number" || !Number.isInteger(count) || count < 0)
  ) {
    throw new DeclareConstraintJsonError(
      `${location}.count must be a non-negative integer when present.`,
    );
  }
  return {
    id: requireNonEmptyString(constraint.id, `${location}.id`),
    template: parseTemplateId(constraint.template, `${location}.template`),
    enabled: requireBoolean(constraint.enabled, `${location}.enabled`),
    ...(constraint.activation !== undefined
      ? {
          activation: parsePredicateGroup(
            constraint.activation,
            `${location}.activation`,
          ),
        }
      : {}),
    ...(constraint.target !== undefined
      ? {
          target: parsePredicateGroup(constraint.target, `${location}.target`),
        }
      : {}),
    ...(constraint.between !== undefined
      ? {
          between: parsePredicateGroup(
            constraint.between,
            `${location}.between`,
          ),
        }
      : {}),
    ...(constraint.correlation !== undefined
      ? {
          correlation: parseCorrelationCondition(
            constraint.correlation,
            `${location}.correlation`,
          ),
        }
      : {}),
    ...(count !== undefined ? { count: count as number } : {}),
  };
}

export function parseDeclareConstraintsJson(
  value: unknown,
  location = "declareConstraints",
): DeclareConstraint[] {
  const constraints = requireArray(value, location).map((constraint, index) =>
    parseDeclareConstraint(constraint, `${location}[${index}]`),
  );
  const ids = new Set<string>();
  constraints.forEach((constraint) => {
    if (ids.has(constraint.id)) {
      throw new DeclareConstraintJsonError(
        `Duplicate Declare constraint ID: ${constraint.id}.`,
      );
    }
    ids.add(constraint.id);
  });
  return constraints;
}
