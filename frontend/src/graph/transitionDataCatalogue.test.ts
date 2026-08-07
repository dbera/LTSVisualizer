import { describe, expect, it } from "vitest";

import {
  buildTransitionDataCatalogue,
  formatTransitionDataPath,
  getTransitionDataFields,
} from "./transitionDataCatalogue";

describe("formatTransitionDataPath", () => {
  it("formats object and normalized array-item paths", () => {
    expect(
      formatTransitionDataPath("outputs", ["completed", "[]", "id"]),
    ).toBe("outputs.completed[].id");
  });
});

describe("buildTransitionDataCatalogue", () => {
  it("discovers nested input and output fields", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "ProcessRequest",
        inputs: {
          request: {
            id: 42,
            priority: 5,
            urgent: true,
          },
        },
        outputs: {
          accepted: true,
        },
      },
    ]);

    expect(catalogue.allFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayPath: "inputs.request.id",
          valueTypes: ["number"],
          occurrenceCount: 1,
        }),
        expect.objectContaining({
          displayPath: "inputs.request.urgent",
          valueTypes: ["boolean"],
        }),
        expect.objectContaining({
          displayPath: "outputs.accepted",
          valueTypes: ["boolean"],
        }),
      ]),
    );
  });

  it("normalizes and discovers fields inside array items", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "CompleteRequest",
        outputs: {
          completed: [
            { id: 42, status: "ok" },
            { id: 57, status: "queued" },
          ],
        },
      },
    ]);

    expect(catalogue.allFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayPath: "outputs.completed",
          valueTypes: ["array"],
          occurrenceCount: 1,
        }),
        expect.objectContaining({
          displayPath: "outputs.completed[]",
          valueTypes: ["object"],
          occurrenceCount: 2,
        }),
        expect.objectContaining({
          displayPath: "outputs.completed[].id",
          valueTypes: ["number"],
          occurrenceCount: 2,
        }),
      ]),
    );
  });

  it("deduplicates paths and records observed types and occurrences", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "Update",
        inputs: { value: 1 },
      },
      {
        transition: "Update",
        inputs: { value: "one" },
      },
      {
        transition: "Other",
        inputs: { value: 2 },
      },
    ]);

    const field = catalogue.allFields.find(
      (candidate) => candidate.displayPath === "inputs.value",
    );

    expect(field).toEqual({
      source: "inputs",
      path: ["value"],
      displayPath: "inputs.value",
      valueTypes: ["number", "string"],
      occurrenceCount: 3,
    });
  });

  it("keeps transition-specific catalogues separate", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "Submit",
        inputs: { request: { id: 7 } },
      },
      {
        transition: "Complete",
        outputs: { result: { id: 7 } },
      },
    ]);

    expect(
      getTransitionDataFields(catalogue, "Submit").map(
        (field) => field.displayPath,
      ),
    ).toContain("inputs.request.id");
    expect(
      getTransitionDataFields(catalogue, "Submit").map(
        (field) => field.displayPath,
      ),
    ).not.toContain("outputs.result.id");
    expect(
      getTransitionDataFields(catalogue, "Complete").map(
        (field) => field.displayPath,
      ),
    ).toContain("outputs.result.id");
  });

  it("falls back to all fields for a manually entered transition", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "Known",
        inputs: { request: { id: 9 } },
      },
    ]);

    expect(getTransitionDataFields(catalogue, "Unknown")).toBe(
      catalogue.allFields,
    );
  });

  it("sorts transition names and field paths deterministically", () => {
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "Zulu",
        inputs: { z: 1, a: 2 },
      },
      {
        transition: "Alpha",
        outputs: { result: true },
      },
    ]);

    expect(catalogue.transitionNames).toEqual(["Alpha", "Zulu"]);
    expect(catalogue.allFields.map((field) => field.displayPath)).toEqual(
      [...catalogue.allFields.map((field) => field.displayPath)].sort(),
    );
  });

  it("does not retain complete sample values", () => {
    const secret = "confidential-value";
    const catalogue = buildTransitionDataCatalogue([
      {
        transition: "SecretTransition",
        inputs: { secret },
      },
    ]);

    expect(JSON.stringify(catalogue)).not.toContain(secret);
  });

  it("does not mutate edge data", () => {
    const edges = [
      {
        transition: "Process",
        inputs: { request: { id: 1 } },
        outputs: { completed: [{ id: 1 }] },
      },
    ];
    const original = structuredClone(edges);

    buildTransitionDataCatalogue(edges);

    expect(edges).toEqual(original);
  });
});
