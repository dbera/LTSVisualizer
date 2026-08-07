import type {
  ComparisonOperator,
  DataPathSegment,
  DataSource,
  JsonPrimitive,
  TransitionCondition,
} from "./transitionConditions";

export type ConditionValueType = "string" | "number" | "boolean" | "null";

export type FlatTransitionCondition = {
  source: DataSource;
  path: DataPathSegment[];
  operator: ComparisonOperator;
  value?: JsonPrimitive;
};

export function readFlatTransitionConditions(
  condition: TransitionCondition | undefined,
): FlatTransitionCondition[] | null {
  if (condition === undefined) return [];

  const conditions = condition.type === "group"
    ? condition.operator === "and"
      ? condition.conditions
      : null
    : [condition];

  if (conditions === null) return null;

  const result: FlatTransitionCondition[] = [];

  for (const item of conditions) {
    if (item.type !== "source" || item.condition.type !== "comparison") {
      return null;
    }

    result.push({
      source: item.source,
      path: [...item.condition.path],
      operator: item.condition.operator,
      ...(item.condition.value !== undefined
        ? { value: item.condition.value as JsonPrimitive }
        : {}),
    });
  }

  return result;
}

export function createFlatTransitionCondition(
  conditions: readonly FlatTransitionCondition[],
): TransitionCondition | undefined {
  const sourceConditions: TransitionCondition[] = conditions.map((item) => ({
    type: "source",
    source: item.source,
    condition: {
      type: "comparison",
      path: [...item.path],
      operator: item.operator,
      ...(item.operator === "exists" || item.operator === "does-not-exist"
        ? {}
        : { value: item.value ?? null }),
    },
  }));

  if (sourceConditions.length === 0) return undefined;
  if (sourceConditions.length === 1) return sourceConditions[0];

  return {
    type: "group",
    operator: "and",
    conditions: sourceConditions,
  };
}

export function parseConditionValue(
  valueType: ConditionValueType,
  text: string,
): JsonPrimitive {
  switch (valueType) {
    case "string":
      return text;
    case "number": {
      const value = Number(text);
      if (!Number.isFinite(value)) {
        throw new Error("Enter a valid number.");
      }
      return value;
    }
    case "boolean":
      if (text === "true") return true;
      if (text === "false") return false;
      throw new Error("Choose true or false.");
    case "null":
      return null;
  }
}

export function inferConditionValueType(
  valueTypes: readonly string[],
): ConditionValueType {
  if (valueTypes.length === 1) {
    const [valueType] = valueTypes;
    if (
      valueType === "string" ||
      valueType === "number" ||
      valueType === "boolean" ||
      valueType === "null"
    ) {
      return valueType;
    }
  }

  return "string";
}
