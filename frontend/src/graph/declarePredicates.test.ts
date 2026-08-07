import { describe, expect, it } from "vitest";

import {
  evaluateDeclarePredicate,
  evaluateDeclarePredicateGroup,
  expandPredicateGroup,
} from "./declarePredicates";

const edge = {
  transition: "SubmitRequest",
  inputs: {
    request: { id: 42, priority: 7 },
  },
  outputs: {},
};

describe("evaluateDeclarePredicate", () => {
  it("matches transition identity and data together", () => {
    const result = evaluateDeclarePredicate(
      {
        transition: { operator: "equals", value: "SubmitRequest" },
        condition: {
          type: "source",
          source: "inputs",
          condition: {
            type: "comparison",
            path: ["request", "priority"],
            operator: ">=",
            value: 5,
          },
        },
      },
      edge,
    );

    expect(result).toEqual({ matches: true, bindings: {}, errors: [] });
  });

  it("does not match when either identity or data fails", () => {
    expect(
      evaluateDeclarePredicate(
        { transition: { operator: "equals", value: "Other" } },
        edge,
      ).matches,
    ).toBe(false);

    expect(
      evaluateDeclarePredicate(
        {
          transition: { operator: "equals", value: "SubmitRequest" },
          condition: {
            type: "source",
            source: "inputs",
            condition: {
              type: "comparison",
              path: ["request", "priority"],
              operator: ">",
              value: 10,
            },
          },
        },
        edge,
      ).matches,
    ).toBe(false);
  });

  it("captures activation bindings only after a successful match", () => {
    expect(
      evaluateDeclarePredicate(
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
        edge,
      ),
    ).toEqual({
      matches: true,
      bindings: { request_id: 42 },
      errors: [],
    });
  });
});

describe("evaluateDeclarePredicateGroup", () => {
  it("matches an OR group when any predicate matches", () => {
    const result = evaluateDeclarePredicateGroup(
      {
        relation: "or",
        predicates: [
          { transition: { operator: "equals", value: "Other" } },
          { transition: { operator: "equals", value: "SubmitRequest" } },
        ],
      },
      edge,
    );

    expect(result.matches).toBe(true);
    expect(result.predicateMatches.map((match) => match.predicateIndex)).toEqual([
      1,
    ]);
  });

  it("matches an AND group only when every predicate matches", () => {
    const result = evaluateDeclarePredicateGroup(
      {
        relation: "and",
        predicates: [
          { transition: { operator: "equals", value: "SubmitRequest" } },
          {
            condition: {
              type: "source",
              source: "inputs",
              condition: {
                type: "comparison",
                path: ["request", "id"],
                operator: "=",
                value: 42,
              },
            },
          },
        ],
      },
      edge,
    );

    expect(result.matches).toBe(true);
    expect(result.predicateMatches).toHaveLength(2);
  });

  it("expands AND groups into independent primitive obligations", () => {
    const group = {
      relation: "and" as const,
      predicates: [
        { transition: { operator: "equals" as const, value: "A" } },
        { transition: { operator: "equals" as const, value: "B" } },
      ],
    };

    expect(expandPredicateGroup(group)).toEqual([
      { relation: "or", predicates: [group.predicates[0]] },
      { relation: "or", predicates: [group.predicates[1]] },
    ]);
  });
});
