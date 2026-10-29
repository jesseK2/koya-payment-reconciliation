// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js
//
// Rules (from README):
//  - each line is one event; skip lines that can't be read and events without a txn_id
//  - a transaction can be attempted several times; only the latest attempt counts
//  - a transaction is collected only when its latest attempt is "success"

const fs = require("fs");

/** Amounts arrive as numbers or as comma-formatted strings ("4,804.15"). */
function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function eventTime(value) {
  const ms = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? -Infinity : ms;
}

const latestByTxn = new Map();

const lines = fs.readFileSync("payments.jsonl", "utf8").split("\n");
lines.forEach((line, index) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let event;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return; // truncated / unreadable line
  }
  if (!event || typeof event !== "object") return;

  const txnId = typeof event.txn_id === "string" ? event.txn_id.trim() : "";
  if (!txnId) return; // event without a txn_id

  const attempt = {
    at: eventTime(event.ts),
    order: index, // tie-break: later line wins
    status: event.status,
    amount: parseAmount(event.amount),
  };

  const prev = latestByTxn.get(txnId);
  if (!prev || attempt.at > prev.at || (attempt.at === prev.at && attempt.order > prev.order)) {
    latestByTxn.set(txnId, attempt);
  }
});

let total = 0;
let count = 0;
for (const attempt of latestByTxn.values()) {
  if (attempt.status === "success" && attempt.amount !== null) {
    total += attempt.amount;
    count += 1;
  }
}

const expected = parseInt(fs.readFileSync("expected.txt", "utf8").trim(), 10);

if (count !== expected) {
  console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
  console.log("Something in the data isn't being handled the way the README describes.");
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.round(total)}`);
}
