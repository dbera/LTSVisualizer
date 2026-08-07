import type {
  DataPathSegment,
  DataSource,
} from "./transitionConditions";

export type TransitionDataValueType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "object"
  | "array";

export type TransitionDataEdge = {
  transition: string;
  inputs?: unknown;
  outputs?: unknown;
};

export type TransitionDataField = {
  source: DataSource;
  path: DataPathSegment[];
  displayPath: string;
  valueTypes: TransitionDataValueType[];
  occurrenceCount: number;
};

export type TransitionDataCatalogue = {
  transitionNames: string[];
  allFields: TransitionDataField[];
  fieldsByTransition: Record<string, TransitionDataField[]>;
};

type MutableField = {
  source: DataSource;
  path: DataPathSegment[];
  displayPath: string;
  valueTypes: Set<TransitionDataValueType>;
  occurrenceCount: number;
};

const ARRAY_ITEM_SEGMENT = "[]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueTypeOf(value: unknown): TransitionDataValueType | null {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  switch (typeof value) {
    case "string":
      return "string";
    case "number":
      return Number.isFinite(value) ? "number" : null;
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    default:
      return null;
  }
}

function fieldKey(source: DataSource, path: readonly DataPathSegment[]): string {
  return `${source}:${JSON.stringify(path)}`;
}

export function formatTransitionDataPath(
  source: DataSource,
  path: readonly DataPathSegment[],
): string {
  if (path.length === 0) return source;

  let result = source;

  for (const segment of path) {
    if (segment === ARRAY_ITEM_SEGMENT) {
      result += ARRAY_ITEM_SEGMENT;
    } else if (typeof segment === "number") {
      result += `[${segment}]`;
    } else {
      result += `.${segment}`;
    }
  }

  return result;
}

function recordField(
  fields: Map<string, MutableField>,
  source: DataSource,
  path: DataPathSegment[],
  value: unknown,
): void {
  const valueType = valueTypeOf(value);
  if (valueType === null) return;

  const key = fieldKey(source, path);
  const existing = fields.get(key);

  if (existing) {
    existing.valueTypes.add(valueType);
    existing.occurrenceCount += 1;
    return;
  }

  fields.set(key, {
    source,
    path: [...path],
    displayPath: formatTransitionDataPath(source, path),
    valueTypes: new Set([valueType]),
    occurrenceCount: 1,
  });
}

function discoverValue(
  fields: Map<string, MutableField>,
  source: DataSource,
  path: DataPathSegment[],
  value: unknown,
): void {
  recordField(fields, source, path, value);

  if (Array.isArray(value)) {
    for (const item of value) {
      discoverValue(fields, source, [...path, ARRAY_ITEM_SEGMENT], item);
    }
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      discoverValue(fields, source, [...path, key], child);
    }
  }
}

function immutableFields(fields: Map<string, MutableField>): TransitionDataField[] {
  return [...fields.values()]
    .map((field) => ({
      source: field.source,
      path: [...field.path],
      displayPath: field.displayPath,
      valueTypes: [...field.valueTypes].sort(),
      occurrenceCount: field.occurrenceCount,
    }))
    .sort(
      (left, right) =>
        left.displayPath.localeCompare(right.displayPath) ||
        left.valueTypes.join(",").localeCompare(right.valueTypes.join(",")),
    );
}

function discoverEdgeFields(
  edge: TransitionDataEdge,
  fields: Map<string, MutableField>,
): void {
  if (edge.inputs !== undefined && edge.inputs !== null) {
    discoverValue(fields, "inputs", [], edge.inputs);
  }

  if (edge.outputs !== undefined && edge.outputs !== null) {
    discoverValue(fields, "outputs", [], edge.outputs);
  }
}

/**
 * Discovers structured input and output paths without retaining sample values.
 * Array indexes are normalized to [] so equivalent token fields are combined.
 */
export function buildTransitionDataCatalogue(
  edges: readonly TransitionDataEdge[],
): TransitionDataCatalogue {
  const allFields = new Map<string, MutableField>();
  const fieldsByTransition = new Map<string, Map<string, MutableField>>();
  const transitionNames = new Set<string>();

  for (const edge of edges) {
    transitionNames.add(edge.transition);
    discoverEdgeFields(edge, allFields);

    const transitionFields =
      fieldsByTransition.get(edge.transition) ?? new Map<string, MutableField>();
    discoverEdgeFields(edge, transitionFields);
    fieldsByTransition.set(edge.transition, transitionFields);
  }

  return {
    transitionNames: [...transitionNames].sort((left, right) =>
      left.localeCompare(right),
    ),
    allFields: immutableFields(allFields),
    fieldsByTransition: Object.fromEntries(
      [...fieldsByTransition.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([transition, fields]) => [transition, immutableFields(fields)]),
    ),
  };
}

export function getTransitionDataFields(
  catalogue: TransitionDataCatalogue,
  transitionName: string,
): readonly TransitionDataField[] {
  return catalogue.fieldsByTransition[transitionName] ?? catalogue.allFields;
}
