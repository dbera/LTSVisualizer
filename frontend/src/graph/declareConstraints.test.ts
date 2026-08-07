import { describe, expect, it } from "vitest";

import {
  DECLARE_TEMPLATE_DEFINITIONS,
  getDeclareTemplateDefinition,
  validateDeclareConstraint,
  type DeclareConstraint,
  type DeclarePredicateGroup,
} from "./declareConstraints";

const predicate = (name: string): DeclarePredicateGroup => ({
  relation: "or",
  predicates: [
    {
      transition: { operator: "equals", value: name },
    },
  ],
});

describe("Declare template registry", () => {
  it("contains the complete planned template catalog with unique IDs", () => {
    expect(DECLARE_TEMPLATE_DEFINITIONS).toHaveLength(30);
    const ids = DECLARE_TEMPLATE_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records roles and capabilities for representative templates", () => {
    expect(getDeclareTemplateDefinition("response")).toMatchObject({
      category: "future",
      requiredRoles: ["activation", "target"],
      supportsCount: false,
      supportsCorrelation: true,
    });
    expect(getDeclareTemplateDefinition("at-least")).toMatchObject({
      category: "cardinality",
      requiredRoles: ["activation"],
      supportsCount: true,
      supportsCorrelation: false,
    });
    expect(getDeclareTemplateDefinition("alternate-succession")).toMatchObject({
      category: "bidirectional",
      requiredRoles: ["activation", "target", "between"],
    });
  });
});

describe("validateDeclareConstraint", () => {
  it("accepts a data-aware response constraint", () => {
    const constraint: DeclareConstraint = {
      id: "same-request-completes",
      template: "response",
      enabled: true,
      activation: {
        relation: "or",
        predicates: [
          {
            transition: { operator: "equals", value: "SubmitRequest" },
            captures: [
              {
                alias: "request_id",
                source: "inputs",
                path: ["request", "id"],
              },
            ],
          },
        ],
      },
      target: predicate("CompleteRequest"),
      correlation: {
        type: "comparison",
        left: {
          kind: "target",
          source: "outputs",
          path: ["request", "id"],
        },
        operator: "=",
        right: { kind: "activation", alias: "request_id" },
      },
    };

    expect(validateDeclareConstraint(constraint)).toEqual([]);
  });

  it("requires the roles defined by the template", () => {
    const constraint: DeclareConstraint = {
      id: "incomplete-response",
      template: "response",
      enabled: true,
      activation: predicate("A"),
    };

    expect(validateDeclareConstraint(constraint)).toContain("target is required.");
  });

  it("requires and validates counts for cardinality templates", () => {
    const missingCount: DeclareConstraint = {
      id: "at-least-a",
      template: "at-least",
      enabled: true,
      activation: predicate("A"),
    };
    const invalidCount: DeclareConstraint = {
      ...missingCount,
      count: -1,
    };
    const validCount: DeclareConstraint = {
      ...missingCount,
      count: 2,
    };

    expect(validateDeclareConstraint(missingCount)).toContain(
      "Count must be a non-negative integer.",
    );
    expect(validateDeclareConstraint(invalidCount)).toContain(
      "Count must be a non-negative integer.",
    );
    expect(validateDeclareConstraint(validCount)).toEqual([]);
  });

  it("rejects roles and options not used by a template", () => {
    const constraint: DeclareConstraint = {
      id: "bad-init",
      template: "init",
      enabled: true,
      activation: predicate("A"),
      target: predicate("B"),
      count: 1,
      correlation: {
        type: "comparison",
        left: { kind: "literal", value: 1 },
        operator: "=",
        right: { kind: "literal", value: 1 },
      },
    };

    expect(validateDeclareConstraint(constraint)).toEqual([
      "Init does not support a count.",
      "Init does not support correlation conditions.",
      "Init does not use target.",
    ]);
  });

  it("rejects empty predicates and captures outside activation", () => {
    const constraint: DeclareConstraint = {
      id: "bad-response",
      template: "response",
      enabled: true,
      activation: {
        relation: "and",
        predicates: [{}],
      },
      target: {
        relation: "or",
        predicates: [
          {
            transition: { operator: "equals", value: "" },
            captures: [
              { alias: "bad", source: "outputs", path: ["id"] },
            ],
          },
        ],
      },
    };

    expect(validateDeclareConstraint(constraint)).toEqual([
      "activation.predicates[0] must define a transition name or data condition.",
      "target.predicates[0].transition must not be empty.",
      "target.predicates[0] must not define activation captures.",
    ]);
  });
});
