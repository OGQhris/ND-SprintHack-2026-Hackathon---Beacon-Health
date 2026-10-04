import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeChatRows,
  sortChatRows,
  CHAT_ROW_LIMIT,
} from "../lib/assistant/rows";
import type { ChatRow } from "../lib/assistant/types";

const row = (name: string, daysUntil: number | null): ChatRow => ({
  employeeId: name,
  name,
  daysUntil,
  group: "Registered Nurses",
  status: "expiring",
  tier: 7,
});

test("expiration chips put Alexandria's six days before Taylor's seven days, with unknown dates last", () => {
  const savedRows = [
    row("Taylor Brooks", 7),
    row("Jamie Morgan", 30),
    row("Unknown", null),
    row("Alexandria Truax", 6),
  ];
  assert.deepEqual(
    sortChatRows(savedRows).map((r) => r.name),
    ["Alexandria Truax", "Taylor Brooks", "Jamie Morgan", "Unknown"],
  );
  assert.equal(
    savedRows[0].name,
    "Taylor Brooks",
    "sorting does not mutate saved threads",
  );
});

test("later tool results update existing chips and urgent additions survive the row limit", () => {
  const existing = Array.from({ length: CHAT_ROW_LIMIT }, (_, i) =>
    row(`Employee ${i}`, 30),
  );
  const merged = mergeChatRows(existing, [
    row("Alexandria Truax", 6),
    row("Employee 0", 5),
  ]);
  assert.equal(merged.length, CHAT_ROW_LIMIT);
  assert.deepEqual(
    merged.slice(0, 2).map((r) => [r.name, r.daysUntil]),
    [
      ["Employee 0", 5],
      ["Alexandria Truax", 6],
    ],
  );
  assert.equal(merged.filter((r) => r.employeeId === "Employee 0").length, 1);
});
