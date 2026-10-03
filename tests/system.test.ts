import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import type {
  Response,
  ResponseInputItem,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";
import {
  expirationCategory,
  daysUntilExpiration,
  todayDate,
} from "../lib/expiration";
import {
  candidateFromFields,
  classifyCandidates,
  normalizeDate,
} from "../services/credentialProviders/michiganParser";
import {
  MICHIGAN_URL,
  type CredentialVerificationResult,
} from "../services/credentialProviders/types";
const dir = await mkdtemp(join(tmpdir(), "beacon-tests-"));
process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
process.env.OPENAI_API_KEY = "";
const sqlite = new DatabaseSync(join(dir, "test.db"));
const migration = (await import("node:fs/promises")).readdir;
const migrations = await migration("prisma/migrations");
const name = migrations.find((n) => n.endsWith("_init"))!;
sqlite.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
sqlite.close();
const { db } = await import("../lib/db");
const { listEmployees, matchEmployeeName, summarize } =
  await import("../lib/employees");
const { executeTool, toolDefinitions, explicitlyRequestsBulkVerification } =
  await import("../lib/ai/tools");
const { runResponseLoop } = await import("../lib/ai/responseLoop");
const { readFourthWorksheet, importEmployees } =
  await import("../services/excelImport");
const {
  persistVerification,
  verifyEmployee,
  startVerifyAll,
  getBatchProgress,
} = await import("../services/credentialService");
const { cleanSourceText } =
  await import("../services/credentialProviders/michiganRnPlaywrightProvider");
const dateAfter = (days: number) => {
  const d = new Date(`${todayDate()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
await db.employee.createMany({
  data: [
    {
      id: "a",
      sourceSheet: "RNS",
      sourceRow: 2,
      firstName: "Kathryn",
      lastName: "Cell",
      manager: "Kimblery Gjeltema",
      verificationState: "VERIFIED",
      credentialStatus: "Active",
      expirationDate: dateAfter(20),
      licenseNumber: "test-a",
    },
    {
      id: "b",
      sourceSheet: "RNS",
      sourceRow: 3,
      firstName: "Dawn",
      lastName: "Vadan",
      manager: "Christianna Davison",
      verificationState: "VERIFIED",
      credentialStatus: "Active",
      expirationDate: dateAfter(-1),
      licenseNumber: "test-b",
    },
    {
      id: "c",
      sourceSheet: "RNS",
      sourceRow: 4,
      firstName: "Kathryn",
      lastName: "Clark",
      manager: "Christianna Davison",
    },
    {
      id: "d",
      sourceSheet: "RNS",
      sourceRow: 5,
      firstName: "Test",
      lastName: "Nurse",
      manager: "Christianna Davison",
      verificationState: "NEEDS_REVIEW",
    },
  ],
});
after(async () => {
  await db.$disconnect();
  await rm(dir, { recursive: true, force: true });
});
const call = (name: string, args: unknown, message = "Who needs attention?") =>
  executeTool(name, JSON.stringify(args), { latestUserMessage: message });
test("expiration categories cover day-only boundaries and invalid dates", () => {
  for (const [days, category] of [
    [-1, "EXPIRED"],
    [0, "EXPIRING_WITHIN_7_DAYS"],
    [7, "EXPIRING_WITHIN_7_DAYS"],
    [8, "EXPIRING_WITHIN_14_DAYS"],
    [14, "EXPIRING_WITHIN_14_DAYS"],
    [15, "EXPIRING_WITHIN_30_DAYS"],
    [30, "EXPIRING_WITHIN_30_DAYS"],
    [31, "ACTIVE"],
  ] as const)
    assert.equal(expirationCategory(dateAfter(days)), category);
  assert.equal(expirationCategory(null), "UNKNOWN");
  assert.equal(expirationCategory("2026-02-30"), "UNKNOWN");
  assert.equal(daysUntilExpiration("2028-02-29", "2028-02-28"), 1);
  assert.equal(todayDate(new Date("2026-10-04T02:00:00Z")), "2026-10-03");
});
test("worksheet four only: preserves exact spelling, ignores other sheets, rejects incomplete rows", async () => {
  const workbook = new ExcelJS.Workbook();
  for (let i = 0; i < 3; i++)
    workbook.addWorksheet(`Ignore ${i}`).addRows([
      ["FIRST NAME", "LAST NAME", "MANAGER"],
      ["Do", "Not Import", "Other"],
    ]);
  workbook.addWorksheet("RNS").addRows([
    ["FIRST NAME", "LAST NAME", "MANAGER", "VERIFY CREDENTIALS AT URL"],
    ["Tatyanna", "Rosa", "Kimblery Gjeltema"],
  ]);
  const path = join(dir, "input.xlsx");
  await workbook.xlsx.writeFile(path);
  assert.deepEqual(await readFourthWorksheet(path), [
    {
      sourceSheet: "RNS",
      sourceRow: 2,
      firstName: "Tatyanna",
      lastName: "Rosa",
      manager: "Kimblery Gjeltema",
    },
  ]);
  await assert.rejects(importEmployees(path), /changed employee identity/);
  workbook.worksheets[3].addRow(["Incomplete", "", ""]);
  await workbook.xlsx.writeFile(path);
  await assert.rejects(readFourthWorksheet(path), /Incomplete employee/);
});
test("employee database search and unique/ambiguous name matching", async () => {
  const records = await listEmployees();
  assert.equal(records.length, 4);
  assert.equal(matchEmployeeName(records, "Kathryn", "Cell").employee?.id, "a");
  assert.equal(
    matchEmployeeName(records, "Kathryn", "C").clarificationRequired,
    true,
  );
  assert.equal(matchEmployeeName(records, "Unknown", "Person").found, false);
  const found = (await call("get_employee_by_name", {
    firstName: "Kathryn",
    lastName: "Cell",
  })) as { employee: { id: string } };
  assert.equal(found.employee.id, "a");
  const partial = (await call("search_employees", { query: "Kathryn" })) as {
    employees: unknown[];
  };
  assert.equal(partial.employees.length, 2);
});
test("expiration, manager, summary, attention, unverified and expired database tools", async () => {
  const expiring = (await call("get_credentials_expiring_within_days", {
    days: 30,
  })) as { employees: { id: string }[] };
  assert.deepEqual(
    expiring.employees.map((e) => e.id),
    ["a"],
  );
  const expired = (await call("get_expired_credentials", {})) as {
    employees: { id: string }[];
  };
  assert.deepEqual(
    expired.employees.map((e) => e.id),
    ["b"],
  );
  const manager = (await call("get_employees_by_manager", {
    managerName: "Christianna Davison",
  })) as { employees: unknown[] };
  assert.equal(manager.employees.length, 3);
  const unverified = (await call("get_unverified_employees", {})) as {
    employees: { id: string }[];
  };
  assert.deepEqual(
    unverified.employees.map((e) => e.id),
    ["c"],
  );
  const attention = (await call("get_attention_needed", {})) as {
    count: number;
  };
  assert.equal(attention.count, 3);
  const summary = (await call("get_credential_summary", {})) as {
    summary: {
      total: number;
      active: number;
      expired: number;
      unverified: number;
      expiringWithin30Days: number;
    };
  };
  assert.deepEqual(
    [
      summary.summary.total,
      summary.summary.active,
      summary.summary.expired,
      summary.summary.unverified,
      summary.summary.expiringWithin30Days,
    ],
    [4, 2, 1, 1, 1],
  );
  assert.equal(summarize(await listEmployees()).expiringWithin7Days, 0);
});
test("strict JSON schemas, Zod validation, unknown tool rejection and mutation authorization", async () => {
  assert.equal(toolDefinitions.length, 10);
  for (const tool of toolDefinitions) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters?.additionalProperties, false);
  }
  for (const args of [
    { days: -1 },
    { days: 1.5 },
    { days: 30, sql: "DROP TABLE Employee" },
    {},
  ]) {
    const result = (await call(
      "get_credentials_expiring_within_days",
      args,
    )) as { ok: boolean };
    assert.equal(result.ok, false);
  }
  assert.equal(
    (
      (await executeTool("execute_sql", "{}", { latestUserMessage: "x" })) as {
        ok: boolean;
      }
    ).ok,
    false,
  );
  assert.equal(
    (
      (await executeTool("search_employees", "not json", {
        latestUserMessage: "x",
      })) as { ok: boolean }
    ).ok,
    false,
  );
  assert.equal(
    (
      (await call("verify_all_credentials", {}, "Who needs attention?")) as {
        ok: boolean;
      }
    ).ok,
    false,
  );
  assert.equal(
    (
      (await call(
        "verify_employee_credential",
        { employeeId: "a" },
        "When does she expire?",
      )) as { ok: boolean }
    ).ok,
    false,
  );
  assert.equal(explicitlyRequestsBulkVerification("Verify everybody."), true);
  assert.equal(
    explicitlyRequestsBulkVerification("Do not verify all credentials"),
    false,
  );
});
const candidate = candidateFromFields({
  "License Type": "Registered Nurse",
  "License Number": "4704214941",
  Name: "Kathryn L Cell",
  "License Status": "Active",
  "License Issue Date": "03/04/1998",
  "License Expiration Date": "03/04/2028",
  County: "Kalamazoo",
});
test("Playwright parsing normalizes date and invisible characters; source facts remain separate from expiration", () => {
  assert.equal(
    cleanSourceText("A\u200bc\u200bt\u200bi\u200bv\u200be"),
    "Active",
  );
  assert.equal(normalizeDate("03/04/2028"), "2028-03-04");
  assert.equal(normalizeDate("02/30/2028"), null);
  assert.equal(candidate.issueDate, "1998-03-04");
  assert.equal(candidate.county, "Kalamazoo");
  const result = classifyCandidates(
    [candidate],
    { firstName: "Kathryn", lastName: "Cell" },
    {},
  );
  assert.equal(result.state, "VERIFIED");
  assert.equal(result.credential?.status, "Active");
});
test("NOT_FOUND, ambiguous NEEDS_REVIEW, pagination, wrong professions, misspelled names and missing fields", () => {
  const employee = { firstName: "Kathryn", lastName: "Cell" };
  assert.equal(classifyCandidates([], employee, {}).state, "NOT_FOUND");
  assert.equal(
    classifyCandidates(
      [candidate, { ...candidate, licenseNumber: "another" }],
      employee,
      {},
    ).state,
    "NEEDS_REVIEW",
  );
  assert.equal(
    classifyCandidates([candidate], employee, {}, false).state,
    "NEEDS_REVIEW",
  );
  assert.equal(
    classifyCandidates(
      [{ ...candidate, credentialType: "Registered Nurse Temporary" }],
      employee,
      {},
    ).state,
    "NEEDS_REVIEW",
  );
  assert.equal(
    classifyCandidates(
      [candidate],
      { firstName: "Katherine", lastName: "Cell" },
      {},
    ).state,
    "NEEDS_REVIEW",
  );
  assert.equal(
    classifyCandidates([{ ...candidate, expirationDate: null }], employee, {})
      .state,
    "NEEDS_REVIEW",
  );
});
function completed(output: Response["output"]): ResponseStreamEvent {
  return {
    type: "response.completed",
    sequence_number: 1,
    response: { id: "resp_test", status: "completed", output } as Response,
  };
}
function delta(text: string): ResponseStreamEvent {
  return {
    type: "response.output_text.delta",
    delta: text,
    item_id: "item",
    output_index: 0,
    content_index: 0,
    sequence_number: 1,
    logprobs: [],
  };
}
async function* events(...items: ResponseStreamEvent[]) {
  for (const item of items) yield item;
}
test("Responses loop executes multiple real database tools, preserves tool call outputs, then streams final text", async () => {
  const emitted: string[] = [];
  let round = 0;
  const answer = await runResponseLoop({
    latestUserMessage: "Compare Kathryn Cell and Dawn Vadan.",
    history: [
      { role: "user", content: "Compare Kathryn Cell and Dawn Vadan." },
    ],
    emit: (e) => emitted.push(e.type),
    transport: async (params) => {
      round++;
      if (round === 1)
        return events(
          completed([
            {
              type: "function_call",
              name: "get_employee_by_name",
              call_id: "call_a",
              arguments: JSON.stringify({
                firstName: "Kathryn",
                lastName: "Cell",
              }),
            },
            {
              type: "function_call",
              name: "get_employee_by_name",
              call_id: "call_b",
              arguments: JSON.stringify({
                firstName: "Dawn",
                lastName: "Vadan",
              }),
            },
          ]),
        );
      const input = params.input as ResponseInputItem[];
      const outputs = input.filter((x) => x.type === "function_call_output");
      if (round === 2) assert.equal(outputs.length, 2);
      assert.ok(JSON.stringify(outputs).includes("test-a"));
      assert.ok(JSON.stringify(outputs).includes("test-b"));
      if (round === 2)
        return events(
          completed([
            {
              type: "function_call",
              name: "get_credential_summary",
              call_id: "call_summary",
              arguments: "{}",
            },
          ]),
        );
      assert.equal(outputs.length, 3);
      return events(
        delta("Kathryn "),
        delta("and Dawn were checked."),
        completed([]),
      );
    },
  });
  assert.equal(round, 3);
  assert.equal(answer, "Kathryn and Dawn were checked.");
  assert.equal(emitted.filter((x) => x === "tool_call_complete").length, 3);
  assert.equal(emitted.filter((x) => x === "text_delta").length, 2);
});
test("multi-turn prior messages are passed without injecting the database; interrupted streams fail gracefully", async () => {
  let received = false;
  await runResponseLoop({
    latestUserMessage: "When does she expire?",
    history: [
      { role: "user", content: "Tell me about Kathryn Cell." },
      {
        role: "assistant",
        content: "Kathryn Cell is the employee we are discussing.",
      },
      { role: "user", content: "When does she expire?" },
    ],
    emit: () => {},
    transport: async (params) => {
      received = true;
      assert.ok(JSON.stringify(params.input).includes("Kathryn Cell"));
      assert.ok(!JSON.stringify(params.input).includes("test-b"));
      return events(delta("I will check her current record."), completed([]));
    },
  });
  assert.equal(received, true);
  await assert.rejects(
    runResponseLoop({
      latestUserMessage: "hi",
      history: [],
      emit: () => {},
      transport: async () => events(delta("partial")),
    }),
    /ended unexpectedly/,
  );
});
test("verification persistence writes audited source fields and failed rechecks preserve older source facts", async () => {
  const result: CredentialVerificationResult = {
    state: "VERIFIED",
    source: "Michigan MILARA",
    sourceUrl: MICHIGAN_URL,
    checkedAt: new Date().toISOString(),
    credential: candidate,
    candidates: [candidate],
    rawFields: { licenseNumber: candidate.licenseNumber },
    error: null,
  };
  const employee = await verifyEmployee("a", {
    verify: async (record) => {
      assert.equal(record.firstName, "Kathryn");
      return result;
    },
  });
  assert.equal(employee.expirationDate, "2028-03-04");
  assert.equal(employee.verificationState, "VERIFIED");
  const errorResult = await verifyEmployee("a", {
    verify: async () => {
      throw new Error("Network test failure");
    },
  });
  assert.equal(errorResult.verificationState, "ERROR");
  assert.equal(errorResult.licenseNumber, "4704214941");
  assert.equal(errorResult.lastVerifiedAt, employee.lastVerifiedAt);
  const audits = await db.verificationAudit.findMany({
    where: { employeeId: "a" },
  });
  assert.equal(audits.length, 2);
  assert.equal(audits[0].source, "Michigan MILARA");
  assert.ok(JSON.parse(audits[0].normalizedJson).rawFields);
  const notFound = {
    ...result,
    state: "NOT_FOUND" as const,
    credential: null,
    candidates: [],
  };
  await persistVerification("c", notFound);
  assert.equal(
    (await db.employee.findUnique({ where: { id: "c" } }))?.verificationState,
    "NOT_FOUND",
  );
});
test("backend routes query records, return missing employees, protect cross-origin writes, and expose helpful missing-key state", async () => {
  const employeesRoute = await import("../app/api/employees/route");
  const r = await employeesRoute.GET(
    new Request("http://localhost/api/employees?manager=Christianna%20Davison"),
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).employees.length, 3);
  const detailRoute = await import("../app/api/employees/[id]/route");
  assert.equal(
    (
      await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "missing" }),
      })
    ).status,
    404,
  );
  const chatRoute = await import("../app/api/chat/route");
  const missing = await chatRoute.POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    }),
  );
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, "KEY_MISSING");
  const forbidden = await chatRoute.POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { origin: "https://other.example" },
      body: "{}",
    }),
  );
  assert.equal(forbidden.status, 403);
});

test("verify-all is sequential, deduplicates running batches, and publishes truthful progress", async () => {
  let running = 0,
    peak = 0;
  const calls: string[] = [];
  const provider = {
    verify: async (employee: { firstName: string; lastName: string }) => {
      running++;
      peak = Math.max(peak, running);
      calls.push(employee.firstName);
      await new Promise((r) => setTimeout(r, 15));
      running--;
      return {
        state: "NOT_FOUND" as const,
        source: "Michigan MILARA" as const,
        sourceUrl: MICHIGAN_URL,
        checkedAt: new Date().toISOString(),
        credential: null,
        candidates: [],
        rawFields: { fixture: true },
        error: "No RN results.",
      };
    },
  };
  const first = await startVerifyAll(provider);
  const duplicate = await startVerifyAll(provider);
  assert.equal(first.running, true);
  assert.equal(duplicate.startedAt, first.startedAt);
  for (let i = 0; getBatchProgress().running && i < 100; i++)
    await new Promise((r) => setTimeout(r, 10));
  const progress = getBatchProgress();
  assert.equal(progress.running, false);
  assert.equal(progress.completed, 4);
  assert.equal(progress.failed, 4);
  assert.equal(peak, 1);
  assert.equal(calls.length, 4);
  assert.ok(progress.finishedAt);
});
