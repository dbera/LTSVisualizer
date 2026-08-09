import { describe, expect, it } from "vitest";
import { parseDeclareConstraintsJson } from "./declareConstraintJson";

describe("parseDeclareConstraintsJson", () => {
  it("parses nested conditions, captures, and correlation data", () => {
    const value = [
      {
        id: "same-request-completes",
        template: "response",
        enabled: true,
        activation: {
          relation: "or",
          predicates: [
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
              captures: [
                { alias: "request_id", source: "inputs", path: ["request", "id"] },
              ],
            },
          ],
        },
        target: {
          relation: "or",
          predicates: [
            { transition: { operator: "equals", value: "CompleteRequest" } },
          ],
        },
        correlation: {
          type: "contains-item",
          source: "outputs",
          path: ["completed"],
          condition: {
            type: "comparison",
            left: { kind: "item", path: ["id"] },
            operator: "=",
            right: { kind: "activation", alias: "request_id" },
          },
        },
      },
    ];

    expect(parseDeclareConstraintsJson(value)).toEqual(value);
  });

  it("keeps structurally valid editable drafts", () => {
    const draft = [
      {
        id: "draft-response",
        template: "response",
        enabled: false,
        activation: { relation: "or", predicates: [{}] },
      },
    ];
    expect(parseDeclareConstraintsJson(draft)).toEqual(draft);
  });

  it("rejects unknown templates and malformed nested values", () => {
    expect(() =>
      parseDeclareConstraintsJson([
        { id: "bad", template: "unknown", enabled: true },
      ]),
    ).toThrow(/unknown Declare template/);

    expect(() =>
      parseDeclareConstraintsJson([
        {
          id: "bad-path",
          template: "response",
          enabled: true,
          activation: {
            relation: "or",
            predicates: [
              {
                condition: {
                  type: "source",
                  source: "inputs",
                  condition: {
                    type: "comparison",
                    path: ["items", -1],
                    operator: "exists",
                  },
                },
              },
            ],
          },
        },
      ]),
    ).toThrow(/non-negative integer/);
  });

  it("rejects duplicate constraint IDs", () => {
    expect(() =>
      parseDeclareConstraintsJson([
        { id: "duplicate", template: "init", enabled: true },
        { id: "duplicate", template: "end", enabled: false },
      ]),
    ).toThrow(/Duplicate Declare constraint ID/);
  });
});
