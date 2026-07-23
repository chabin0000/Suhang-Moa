import { describe, expect, it } from "vitest";

describe("test tooling", () => {
  it("runs in the jsdom environment", () => {
    expect(document.createElement("div")).toBeInstanceOf(HTMLDivElement);
  });
});
