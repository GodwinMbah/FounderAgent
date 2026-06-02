import { describe, it, expect } from "vitest";
import { detectPersonalName } from "../personal-name-detector";

describe("detectPersonalName", () => {
  it("detects First Last as high-confidence personal name", () => {
    const result = detectPersonalName("John Smith");
    expect(result.isPersonalName).toBe(true);
    expect(result.confidence).toBe(85);
    expect(result.reason).toContain("First Last");
  });

  it("detects Initial Last as medium-confidence personal name", () => {
    const result = detectPersonalName("J. Smith");
    expect(result.isPersonalName).toBe(true);
    expect(result.confidence).toBe(60);
    expect(result.reason).toContain("Initial Last");
  });

  it("excludes business names with Limited", () => {
    const result = detectPersonalName("Smith Limited");
    expect(result.isPersonalName).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it("excludes business names with Bank", () => {
    const result = detectPersonalName("John Bank");
    expect(result.isPersonalName).toBe(false);
  });

  it("excludes names with digits", () => {
    const result = detectPersonalName("John Smith 123");
    expect(result.isPersonalName).toBe(false);
  });

  it("suggests Revenue for positive amount with invoice reference", () => {
    const result = detectPersonalName("John Smith", 500, "Invoice 123");
    expect(result.isPersonalName).toBe(true);
    expect(result.suggestedCategories).toContain("Revenue");
    expect(result.suggestedCategories).toContain("Contractors");
  });

  it("suggests Payroll for negative amount with salary reference", () => {
    const result = detectPersonalName("Jane Doe", -2000, "Monthly salary");
    expect(result.isPersonalName).toBe(true);
    expect(result.suggestedCategories).toEqual(["Payroll"]);
  });

  it("suggests Owner Drawings for negative amount with dividend reference", () => {
    const result = detectPersonalName("Bob Wilson", -1500, "Dividend payment");
    expect(result.isPersonalName).toBe(true);
    expect(result.suggestedCategories).toEqual(["Owner Drawings"]);
  });

  it("suggests Family Support for negative amount with family reference", () => {
    const result = detectPersonalName("Alice Brown", -500, "Family support");
    expect(result.isPersonalName).toBe(true);
    expect(result.suggestedCategories).toEqual(["Family Support"]);
  });

  it("returns empty categories for unclear personal name context", () => {
    const result = detectPersonalName("Charlie Day", -100, "Random ref");
    expect(result.isPersonalName).toBe(true);
    expect(result.suggestedCategories).toHaveLength(0);
    expect(result.reason).toContain("review needed");
  });

  it("rejects single word", () => {
    const result = detectPersonalName("Smith");
    expect(result.isPersonalName).toBe(false);
  });

  it("finds name embedded in longer description", () => {
    const result = detectPersonalName("Payment to John Smith for consulting");
    expect(result.isPersonalName).toBe(true);
    expect(result.confidence).toBe(85);
  });

  it("rejects too many words", () => {
    const result = detectPersonalName("John Smith Consulting Services");
    expect(result.isPersonalName).toBe(false);
  });
});
