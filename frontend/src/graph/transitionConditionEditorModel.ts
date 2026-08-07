import type {
  ComparisonOperator,
  DataPathSegment,
  DataSource,
  JsonPrimitive,
  TransitionCondition,
  ValueCondition,
} from "./transitionConditions";

export const ARRAY_ITEM_SEGMENT = "[]";
export type ConditionValueType = "string" | "number" | "boolean" | "null";
export type ArrayAccess =
  | { mode: "contains-item" }
  | { mode: "indexed-item"; index: number };

export type FlatTransitionCondition = {
  source: DataSource;
  path: DataPathSegment[];
  arrayAccesses: ArrayAccess[];
  operator: ComparisonOperator;
  value?: JsonPrimitive;
};

function normalizePath(path: readonly DataPathSegment[]): {
  path: DataPathSegment[];
  arrayAccesses: ArrayAccess[];
} {
  const arrayAccesses: ArrayAccess[] = [];
  const normalized = path.map((segment) => {
    if (typeof segment !== "number") return segment;
    arrayAccesses.push({ mode: "indexed-item", index: segment });
    return ARRAY_ITEM_SEGMENT;
  });
  return { path: normalized, arrayAccesses };
}

function readValueCondition(condition: ValueCondition): Omit<FlatTransitionCondition, "source"> | null {
  if (condition.type === "comparison") {
    const normalized = normalizePath(condition.path);
    return {
      path: normalized.path,
      arrayAccesses: normalized.arrayAccesses,
      operator: condition.operator,
      ...(condition.value !== undefined
        ? { value: condition.value as JsonPrimitive }
        : {}),
    };
  }

  if (condition.type !== "contains-item") return null;
  const child = readValueCondition(condition.condition);
  if (child === null) return null;
  const collection = normalizePath(condition.path);
  return {
    path: [
      ...collection.path,
      ARRAY_ITEM_SEGMENT,
      ...child.path,
    ],
    arrayAccesses: [
      ...collection.arrayAccesses,
      { mode: "contains-item" },
      ...child.arrayAccesses,
    ],
    operator: child.operator,
    ...(child.value !== undefined ? { value: child.value } : {}),
  };
}

export function readFlatTransitionConditions(
  condition: TransitionCondition | undefined,
): FlatTransitionCondition[] | null {
  if (condition === undefined) return [];
  const conditions = condition.type === "group"
    ? condition.operator === "and" ? condition.conditions : null
    : [condition];
  if (conditions === null) return null;

  const result: FlatTransitionCondition[] = [];
  for (const item of conditions) {
    if (item.type !== "source") return null;
    const flat = readValueCondition(item.condition);
    if (flat === null) return null;
    result.push({ source: item.source, ...flat });
  }
  return result;
}

function validateArrayAccess(access: ArrayAccess): void {
  if (
    access.mode === "indexed-item" &&
    (!Number.isInteger(access.index) || access.index < 0)
  ) {
    throw new Error("Enter a non-negative array index.");
  }
}

export function countArrayLevels(path: readonly DataPathSegment[]): number {
  return path.filter((segment) => segment === ARRAY_ITEM_SEGMENT).length;
}

export function createDefaultArrayAccesses(
  path: readonly DataPathSegment[],
): ArrayAccess[] {
  return Array.from(
    { length: countArrayLevels(path) },
    () => ({ mode: "contains-item" }) as ArrayAccess,
  );
}

export function createValueCondition(
  item: FlatTransitionCondition,
): ValueCondition {
  const expected = countArrayLevels(item.path);
  if (item.arrayAccesses.length !== expected) {
    throw new Error(`Configure all ${expected} array levels.`);
  }
  item.arrayAccesses.forEach(validateArrayAccess);

  const createComparison = (path: DataPathSegment[]): ValueCondition => ({
    type: "comparison",
    path,
    operator: item.operator,
    ...(item.operator === "exists" || item.operator === "does-not-exist"
      ? {}
      : { value: item.value ?? null }),
  });

  function build(
    path: readonly DataPathSegment[],
    accesses: readonly ArrayAccess[],
  ): ValueCondition {
    const markerIndex = path.indexOf(ARRAY_ITEM_SEGMENT);
    if (markerIndex < 0) return createComparison([...path]);

    const access = accesses[0];
    if (access === undefined) throw new Error("Configure every array level.");
    const before = path.slice(0, markerIndex);
    const after = path.slice(markerIndex + 1);

    if (access.mode === "indexed-item") {
      return build([...before, access.index, ...after], accesses.slice(1));
    }
    return {
      type: "contains-item",
      path: [...before],
      condition: build(after, accesses.slice(1)),
    };
  }

  return build(item.path, item.arrayAccesses);
}

export function createFlatTransitionCondition(
  conditions: readonly FlatTransitionCondition[],
): TransitionCondition | undefined {
  const sourceConditions: TransitionCondition[] = conditions.map((item) => ({
    type: "source",
    source: item.source,
    condition: createValueCondition(item),
  }));
  if (sourceConditions.length === 0) return undefined;
  if (sourceConditions.length === 1) return sourceConditions[0];
  return { type: "group", operator: "and", conditions: sourceConditions };
}

export function formatConfiguredPath(
  source: DataSource,
  path: readonly DataPathSegment[],
  accesses: readonly ArrayAccess[],
): string {
  let result = source;
  let level = 0;
  for (const segment of path) {
    if (segment === ARRAY_ITEM_SEGMENT) {
      const access = accesses[level++];
      result += access?.mode === "indexed-item"
        ? `[${access.index}]`
        : "[*]";
    } else if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += `.${segment}`;
    }
  }
  return result;
}

export function parseConditionValue(
  valueType: ConditionValueType,
  text: string,
): JsonPrimitive {
  switch (valueType) {
    case "string": return text;
    case "number": {
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error("Enter a valid number.");
      return value;
    }
    case "boolean":
      if (text === "true") return true;
      if (text === "false") return false;
      throw new Error("Choose true or false.");
    case "null": return null;
  }
}

export function inferConditionValueType(
  valueTypes: readonly string[],
): ConditionValueType {
  if (valueTypes.length === 1) {
    const [valueType] = valueTypes;
    if (["string", "number", "boolean", "null"].includes(valueType)) {
      return valueType as ConditionValueType;
    }
  }
  return "string";
}
