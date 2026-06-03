# FounderAgent Provider Coverage Matrix

This matrix documents the ingestion contract before P4/P5 intelligence work. Exact adapters are preferred when headers match. Unknown files must fall back to `generic_bank` or `manual_csv` and surface mapping confidence/missing fields in Upload Centre.

## Adapter Coverage

| Provider or format | Coverage path | Date | Posted date | Description | Merchant/counterparty | Reference | Amount | Debit/credit | Currency | Fee | Balance | Account | External ID | Type/status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Revolut Business | `revolut_business_csv` exact | Yes | Yes | Yes | Description/Payer/typed extraction | Yes | Yes | N/A | Yes | Yes | Yes | Yes | Yes | Yes | TOPUP/TRANSFER/FEE rules are provider-aware. |
| Tide | `tide` exact | Yes | Fallback metadata if supplied generically | Yes | Description/reference fallback | Yes | N/A | Yes | Company/default | Fallback | Yes | Fallback | Fallback | Category/type | Split Money In/Money Out supported. |
| Monzo | `monzo` exact | Yes | Fallback | Description/notes | Name | Reference fallback | Yes | N/A | Yes | Fallback | Fallback | Fallback | Fallback | Category/type | Local/original currency supported. |
| Starling | `starling` exact | Yes | Fallback | Notes fallback | Counter Party | Yes | Yes | N/A | Company/default | Fallback | Yes | Fallback | Fallback | Type/category | Counterparty is primary merchant signal. |
| Wise | `wise` exact | Yes | Fallback | Yes | Description/counterparty fallback | Payment Reference | Yes | N/A | Yes | Yes | Yes | Fallback | TransferWise ID | Type fallback | Multi-currency and fees supported. |
| Barclays | `barclays` exact | Yes | Fallback | Memo | Memo/account fallback | Memo/ref fallback | Yes | N/A | Company/default | Fallback | Fallback | Yes | Number | Subcategory/type | Amount sign convention is UK-bank style. |
| HSBC | `hsbc` exact | Yes | Fallback | Yes | Description fallback | Fallback | N/A | Yes | Company/default | Fallback | Yes | Fallback | Fallback | Type | Split paid out/paid in supported. |
| Lloyds | `lloyds` exact | Yes | Fallback | Yes | Description fallback | Sort code/ref fallback | N/A | Yes | Company/default | Fallback | Yes | Account number | Fallback | Type | Split debit/credit supported. |
| NatWest | `natwest` exact | Yes | Fallback | Yes | Description fallback | Fallback | Value | N/A | Company/default | Fallback | Yes | Yes | Fallback | Type | Value column supported. |
| Chase | `chase` exact | Posting Date | Details/posted fallback | Yes | Description fallback | Check/slip | Yes | N/A | Company/default | Fallback | Yes | Fallback | Fallback | Type | US statement dates supported. |
| Capital On Tap | Generic credit-card statement path | Yes | Yes if present | Yes | Description/card label fallback | Reference ID if present | Yes | Debit/credit if present | Yes/default | Fee if present | Balance if present | Card/account if present | ID if present | Type/status if present | Credit-card repayments categorised/excluded by merchant/category rules. |
| Capital One | Generic credit-card statement path | Yes | Yes if present | Yes | Description/card label fallback | Reference ID if present | Yes | Debit/credit if present | Yes/default | Fee if present | Balance if present | Card/account if present | ID if present | Type/status if present | Same fallback as Capital On Tap. |
| Amex | Generic credit-card statement path | Yes | Yes if present | Yes | Description/card label fallback | Reference ID if present | Yes | Debit/credit if present | Yes/default | Fee if present | Balance if present | Card/account if present | ID if present | Type/status if present | Amex repayment patterns are categorised as credit-card repayments. |
| Stripe exports | `stripe_csv` exact | Yes | Available-on fallback | Yes | Descriptor/customer | Invoice/transfer IDs | Yes | N/A | Yes | Yes | Net fallback | Card metadata | ID | Report type/status | Payouts are transfers; charges are revenue. |
| PayPal exports | `paypal_csv` exact | Yes | Fallback | Subject/note/name | Name/email | Invoice/ref transaction | Gross | N/A | Yes | Yes | Net fallback | Bank fields | Transaction ID | Type/status | Withdrawals/deposits treated as transfers. |
| Shopify payouts | `shopify_payouts_csv` exact | Payout date | Fallback | Payout status | Shopify fallback | Payout ID | Net/total sales | N/A | Yes | Total fees | Fallback | Fallback | Payout ID | Payout status | Payout rows are processor settlement/transfer context. |
| US debit/credit CSV | `generic_bank` or `manual_csv` | Yes | Yes | Yes | Merchant/name/counterparty/description | Yes | Yes | Yes | Yes/default | Yes | Yes | Yes | Yes | Yes | Ambiguous sign conventions require mapping review/override when signs are not explicit. |
| European decimal CSV | `generic_bank` or `manual_csv` | Yes | Yes | Yes | Merchant/counterparty/description | Yes | Yes | Yes | Yes/default | Yes | Yes | Yes | Yes | Yes | Comma decimals and dot thousands are parsed. |
| Multi-currency file | Exact adapter or generic fallback | Yes | Yes if present | Yes | Yes | Yes | Yes | Yes | Yes | Yes if present | Yes if present | Yes if present | Yes if present | Yes if present | Transaction currency is preserved per row. |
| Unknown global CSV | `manual_csv` fallback | Yes if a date-like header exists | Yes if present | Yes if description/details/memo exists | Merchant/counterparty/name/reference fallback | Yes if present | Yes or split debit/credit | Yes | Yes/default | Yes if present | Yes if present | Yes if present | Yes if present | Yes if present | Missing required mappings must be shown in Upload Centre. |

## Generic Fallback Contract

- `manual_csv` and `generic_bank` must support single `amount` columns and split `debit`/`credit` columns.
- The parser must preserve `date`, `posted_date`, `description`, `merchant`, `reference`, `external_transaction_id`, `transaction_type`, `status`, `currency`, `fee_amount`, `running_balance`, `account`, and raw row metadata when the source file provides them.
- If a provider has no exact adapter, import should not fail solely because the provider name is unknown.
- If critical columns cannot be inferred, Upload Centre should show missing mappings and let the user override them before import.
- Ambiguous sign conventions, especially credit-card exports where positive values may mean spending, remain a review/mapping concern unless the file has debit/credit columns or clear transaction type signals.
