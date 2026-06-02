import { describe, it, expect } from "vitest";
import { isTransfer, isIncome, isExpense } from "@/lib/reporting/filters";

describe("isTransfer", () => {
  it("detects transfer by category", () => {
    expect(isTransfer({ type: "expense", category: "Transfers" })).toBe(true);
  });

  it("detects transfer by tag", () => {
    expect(isTransfer({ type: "expense", tags: ["transfer"] })).toBe(true);
  });

  it("returns false for non-transfer", () => {
    expect(isTransfer({ type: "expense", category: "Software" })).toBe(false);
  });

  it("returns false when category and tags are empty", () => {
    expect(isTransfer({ type: "income" })).toBe(false);
  });
});

describe("isIncome", () => {
  it("returns true for income type", () => {
    expect(isIncome({ type: "income" })).toBe(true);
  });

  it("excludes transfers with income type", () => {
    expect(isIncome({ type: "income", category: "Transfers" })).toBe(false);
  });

  it("excludes transfers with income type and transfer tag", () => {
    expect(isIncome({ type: "income", tags: ["transfer"] })).toBe(false);
  });

  it("returns false for expense type", () => {
    expect(isIncome({ type: "expense" })).toBe(false);
  });
});

describe("isExpense", () => {
  it("returns true for expense type", () => {
    expect(isExpense({ type: "expense" })).toBe(true);
  });

  it("excludes transfers with expense type", () => {
    expect(isExpense({ type: "expense", category: "Transfers" })).toBe(false);
  });

  it("excludes transfers with expense type and transfer tag", () => {
    expect(isExpense({ type: "expense", tags: ["transfer"] })).toBe(false);
  });

  it("returns false for income type", () => {
    expect(isExpense({ type: "income" })).toBe(false);
  });
});

describe("transfer exclusion integration", () => {
  it("a transfer transaction is neither income nor expense", () => {
    const transfer = { type: "expense", category: "Transfers", amount: 5000 };
    expect(isTransfer(transfer)).toBe(true);
    expect(isIncome(transfer)).toBe(false);
    expect(isExpense(transfer)).toBe(false);
  });

  it("a regular transaction is correctly classified", () => {
    const income = { type: "income", category: "Revenue", amount: 10000 };
    const expense = { type: "expense", category: "Software", amount: 500 };

    expect(isIncome(income)).toBe(true);
    expect(isExpense(income)).toBe(false);

    expect(isIncome(expense)).toBe(false);
    expect(isExpense(expense)).toBe(true);
  });
});
