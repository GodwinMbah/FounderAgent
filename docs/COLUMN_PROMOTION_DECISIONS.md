# Column Promotion Decisions — Migration 018

## Overview

Migration 018 promotes several fields from JSONB `metadata` (or implicit absence) to first-class table columns. This document explains why each field was promoted or kept in `metadata`.

---

## Promoted to Real Columns

| Column | Table | Why Promoted |
|--------|-------|--------------|
| `currency` | `transactions` | Required for **filtering** (multi-currency dashboards), **indexing**, and future **Plaid sync** where currency is a first-class attribute. Querying `metadata->>'currency'` bypasses indexes and is slow at scale. |
| `reference` | `transactions` | Required for **search**, **duplicate detection**, and **Plaid matching**. References are stable identifiers that need exact-match lookups and unique constraints in the future. JSONB path queries are too slow for high-frequency dedup checks. |
| `external_transaction_id` | `transactions` | Required for **Plaid ID matching** and **deduplication**. This is an immutable foreign key to an external system. It needs an indexed column for idempotent ingestion and duplicate prevention. |
| `source_provider` | `transactions` | Required for **filtering by provider** and **analytics** (e.g. "show me all Stripe transactions"). A dedicated column allows composite indexing with `company_id` and simple SQL joins. |
| `provider_detected` | `uploads` | Required to know **what provider was detected** during upload ingestion. Drives UI routing (which parser to use) and analytics on detection accuracy. |
| `provider_confidence` | `uploads` | Required to surface **confidence score** of detection to the user and to trigger manual review when confidence is low. A real column with a `CHECK` constraint enforces data integrity (0-100). |

---

## Kept in `metadata` (JSONB)

| Field | Table | Why Kept in Metadata |
|-------|-------|----------------------|
| `posted_date` | `transactions` | Specific to bank-statement CSV parsing; not needed for core filtering or indexing. Used only for display reconciliation. Can be promoted later if search-by-posted-date becomes a requirement. |
| `fee_amount` | `transactions` | Provider-specific detail (common in Stripe/PayPal). Not used for core P&L calculations today (we use `amount`). Kept in metadata until fee analytics becomes a first-class feature. |
| `running_balance` | `transactions` | Specific to bank-statement CSV rows; used only for display/reconciliation. Not needed for filtering, search, or aggregation. |

---

## Guideline for Future Promotions

Promote a field from `metadata` to a real column when **any** of the following are true:

1. The field needs a **database index** for query performance.
2. The field participates in **foreign-key matching** or **deduplication**.
3. The field is used in **WHERE clauses** on high-traffic UI pages.
4. The field needs a **CHECK constraint** or **NOT NULL** rule.
5. The field is referenced by **RLS policies** or **database views**.

Keep the field in `metadata` when it is:

- Provider-specific and rarely queried.
- Used only for display or debugging.
- Not yet stabilised (schema may change frequently).
