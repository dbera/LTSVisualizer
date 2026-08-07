import { describe, expect, it } from "vitest";
import {
  buildTransitionCatalogue,
  filterTransitionOptions,
} from "./transitionCatalog";

describe("transition catalogue", () => {
  it("deduplicates names and counts occurrences", () => {
    expect(buildTransitionCatalogue(["Approve", "Reject", "Approve", " "])).toEqual([
      { name: "Approve", occurrenceCount: 2 },
      { name: "Reject", occurrenceCount: 1 },
    ]);
  });

  it("filters case-insensitively by substring", () => {
    const options = buildTransitionCatalogue([
      "Root_SubmitLoginAttempt",
      "Root_ReceiveResult",
      "Other_SubmitLoginAttempt",
    ]);

    expect(filterTransitionOptions(options, "submit").map((option) => option.name)).toEqual([
      "Other_SubmitLoginAttempt",
      "Root_SubmitLoginAttempt",
    ]);
  });

  it("ranks an exact match before more frequent partial matches", () => {
    const options = buildTransitionCatalogue(["Login", "LoginAttempt", "LoginAttempt"]);
    expect(filterTransitionOptions(options, "login")[0].name).toBe("Login");
  });
});
