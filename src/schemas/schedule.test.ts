import { describe, expect, it } from "vitest";
import { scheduleDraftSchema } from "./schedule";

const validDraft = {
  title: "Leap day schedule",
  subject: "Science",
  description: "Calendar validation",
  type: "exam" as const,
  dueDate: "2024-02-29",
};

describe("scheduleDraftSchema", () => {
  it("accepts a valid leap day", () => {
    expect(scheduleDraftSchema.safeParse(validDraft).success).toBe(true);
  });

  it.each(["2023-02-29", "2024-02-30", "2024-04-31"])(
    "rejects an impossible calendar date: %s",
    (dueDate) => {
      expect(scheduleDraftSchema.safeParse({ ...validDraft, dueDate }).success).toBe(false);
    },
  );
});
