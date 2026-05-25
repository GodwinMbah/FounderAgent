function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // MM/DD/YYYY or MM-DD-YYYY
  const usMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return cleaned;
}

function parseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/[$£€,]/g, "").trim();
  return parseFloat(cleaned) || 0;
}

function detectTypeFromAmount(
  amount: number,
  debitStr?: string,
  creditStr?: string
): "income" | "expense" {
  if (debitStr !== undefined && creditStr !== undefined) {
    const debit = parseFloat(debitStr.replace(/[$£€,]/g, "") || "0");
    const credit = parseFloat(creditStr.replace(/[$£€,]/g, "") || "0");
    if (credit > 0) return "income";
    if (debit > 0) return "expense";
  }
  return amount >= 0 ? "income" : "expense";
}

function parseMerchant(description: string): string {
  const cleaned = description.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ");
  if (parts.length === 0) return "Unknown";
  return parts.slice(0, 2).join(" ");
}

export interface ParsedTransaction extends Record<string, unknown> {
  company_id: string;
  date: string;
  merchant: string;
  description: string;
  category: null;
  amount: number;
  type: "income" | "expense";
  status: string;
}

export function parseBankCsv(
  csvText: string,
  companyId: string
): ParsedTransaction[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, "")
  );

  const idxDate = headers.findIndex(
    (h) =>
      h.includes("date") ||
      h.includes("transaction date") ||
      h.includes("posting date")
  );
  const idxDesc = headers.findIndex(
    (h) =>
      h.includes("description") ||
      h.includes("payee") ||
      h.includes("memo") ||
      h.includes("name")
  );
  const idxAmount = headers.findIndex(
    (h) =>
      h === "amount" ||
      h === "transaction amount" ||
      h === "amount ($)"
  );
  const idxDebit = headers.findIndex(
    (h) => h === "debit" || h === "debit amount"
  );
  const idxCredit = headers.findIndex(
    (h) => h === "credit" || h === "credit amount"
  );
  const idxType = headers.findIndex(
    (h) => h === "type" || h === "transaction type"
  );

  if (idxDate === -1 || idxDesc === -1) return [];
  if (idxAmount === -1 && idxDebit === -1 && idxCredit === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (
      row.length <
      Math.max(idxDate, idxDesc, idxAmount, idxDebit, idxCredit) + 1
    )
      continue;

    const dateStr = row[idxDate];
    const description = row[idxDesc];
    if (!dateStr || !description) continue;

    let amount = 0;
    let type: "income" | "expense" = "expense";

    if (idxAmount !== -1 && row[idxAmount]) {
      const raw = row[idxAmount];
      amount = Math.abs(parseAmount(raw));
      type = detectTypeFromAmount(parseAmount(raw), undefined, undefined);
    } else if (idxDebit !== -1 || idxCredit !== -1) {
      const debit =
        idxDebit !== -1 ? parseAmount(row[idxDebit] || "0") : 0;
      const credit =
        idxCredit !== -1 ? parseAmount(row[idxCredit] || "0") : 0;
      amount = debit > 0 ? debit : credit;
      type = credit > 0 ? "income" : "expense";
    }

    if (idxType !== -1 && row[idxType]) {
      const t = row[idxType].toLowerCase();
      if (
        t.includes("income") ||
        t.includes("credit") ||
        t.includes("deposit")
      )
        type = "income";
      else if (
        t.includes("expense") ||
        t.includes("debit") ||
        t.includes("withdrawal")
      )
        type = "expense";
    }

    if (amount === 0) continue;

    transactions.push({
      company_id: companyId,
      date: normalizeDate(dateStr),
      merchant: parseMerchant(description),
      description,
      category: null,
      amount,
      type,
      status: "needs_review",
    });
  }

  return transactions;
}
