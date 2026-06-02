import { describe, it, expect } from "vitest";
import { groupByCategory, sumByMonth } from "@/lib/reporting/aggregates";

describe("groupByCategory", () => {
  it("groups expenses by category and excludes transfers", () => {
    const transactions = [
      { type: "expense", category: "Software", amount: 100 },
      { type: "expense", category: "Software", amount: 200 },
      { type: "expense", category: "Advertising", amount: 500 },
      { type: "expense", category: "Transfers", amount: 1000 },
      { type: "income", category: "Revenue", amount: 5000 },
    ];

    const result = groupByCategory(transactions, "expense");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Advertising");
    expect(result[0].amount).toBe(500);
    expect(result[1].name).toBe("Software");
    expect(result[1].amount).toBe(300);
  });

  it("groups income by category and excludes transfers", () => {
    const transactions = [
      { type: "income", category: "Revenue", amount: 5000 },
      { type: "income", category: "Revenue", amount: 3000 },
      { type: "income", category: "Transfers", amount: 2000 },
      { type: "expense", category: "Software", amount: 100 },
    ];

    const result = groupByCategory(transactions, "income");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Revenue");
    expect(result[0].amount).toBe(8000);
  });

  it("defaults missing category to Uncategorized", () => {
    const transactions = [
      { type: "expense", amount: 100 },
      { type: "expense", amount: 200 },
    ];

    const result = groupByCategory(transactions, "expense");
    expect(result[0].name).toBe("Uncategorized");
    expect(result[0].amount).toBe(300);
  });

  it("calculates percentages correctly", () => {
    const transactions = [
      { type: "expense", category: "A", amount: 75 },
      { type: "expense", category: "B", amount: 25 },
    ];

    const result = groupByCategory(transactions, "expense");
    expect(result[0].percentage).toBe(75);
    expect(result[1].percentage).toBe(25);
  });

  it("sorts by amount descending", () => {
    const transactions = [
      { type: "expense", category: "Small", amount: 10 },
      { type: "expense", category: "Large", amount: 1000 },
      { type: "expense", category: "Medium", amount: 100 },
    ];

    const result = groupByCategory(transactions, "expense");
    expect(result[0].name).toBe("Large");
    expect(result[1].name).toBe("Medium");
    expect(result[2].name).toBe("Small");
  });
});

describe("sumByMonth", () => {
  it("aggregates revenue and expenses by month", () => {
    const transactions = [
      { type: "income", date: "2024-01-15", amount: 5000, category: "Revenue" },
      { type: "income", date: "2024-01-20", amount: 3000, category: "Revenue" },
      { type: "expense", date: "2024-01-10", amount: 2000, category: "Software" },
      { type: "expense", date: "2024-02-05", amount: 1500, category: "Advertising" },
    ];

    const result = sumByMonth(transactions);
    expect(result).toHaveLength(2);

    const jan = result.find((m) => m.month === "2024-01");
    expect(jan?.revenue).toBe(8000);
    expect(jan?.expenses).toBe(2000);
    expect(jan?.profit).toBe(6000);

    const feb = result.find((m) => m.month === "2024-02");
    expect(feb?.revenue).toBe(0);
    expect(feb?.expenses).toBe(1500);
    expect(feb?.profit).toBe(-1500);
  });

  it("excludes transfers from revenue and expenses", () => {
    const transactions = [
      { type: "income", date: "2024-01-15", amount: 5000, category: "Revenue" },
      { type: "expense", date: "2024-01-15", amount: 5000, category: "Transfers" },
      { type: "income", date: "2024-01-15", amount: 5000, category: "Transfers" },
    ];

    const result = sumByMonth(transactions);
    expect(result[0].revenue).toBe(5000);
    expect(result[0].expenses).toBe(0);
  });

  it("sorts by month ascending", () => {
    const transactions = [
      { type: "income", date: "2024-03-01", amount: 100, category: "Revenue" },
      { type: "income", date: "2024-01-01", amount: 100, category: "Revenue" },
      { type: "income", date: "2024-02-01", amount: 100, category: "Revenue" },
    ];

    const result = sumByMonth(transactions);
    expect(result[0].month).toBe("2024-01");
    expect(result[1].month).toBe("2024-02");
    expect(result[2].month).toBe("2024-03");
  });

  it("handles empty array", () => {
    const result = sumByMonth([]);
    expect(result).toHaveLength(0);
  });
});
