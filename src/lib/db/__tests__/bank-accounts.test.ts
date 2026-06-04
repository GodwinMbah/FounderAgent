import { describe, expect, it } from "vitest";
import { isCashBalanceSourceAccount } from "../bank-account-routing";

describe("bank account cash balance routing", () => {
  it("includes legacy bank accounts when no connected routing metadata exists", () => {
    expect(isCashBalanceSourceAccount({ type: "bank", current_balance: 1000, metadata: {} })).toBe(true);
  });

  it("excludes connected credit cards and loans from cash balance", () => {
    expect(
      isCashBalanceSourceAccount({
        type: "credit_card",
        current_balance: 650,
        metadata: {
          source_kind: "open_banking",
          connected_account_type: "business_credit_card",
          kpi_routing: { cashBalanceSource: false },
        },
      })
    ).toBe(false);

    expect(
      isCashBalanceSourceAccount({
        type: "loan",
        current_balance: 12000,
        metadata: {
          source_kind: "open_banking",
          connected_account_type: "loan",
        },
      })
    ).toBe(false);
  });

  it("includes connected current and savings accounts when routing marks them as cash sources", () => {
    expect(
      isCashBalanceSourceAccount({
        type: "bank",
        current_balance: 4500,
        metadata: {
          source_kind: "open_banking",
          connected_account_type: "business_savings",
          kpi_routing: { cashBalanceSource: true },
        },
      })
    ).toBe(true);
  });
});
