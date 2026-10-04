import { z } from "zod";
import { latestRecordingFor } from "@/services/verificationRecorder";
import type { FunctionTool } from "openai/resources/responses/responses";
import {
  listEmployees,
  matchEmployeeName,
  searchEmployeesIn,
  needsAttention,
  summarize,
} from "@/lib/employees";
import {
  verifyEmployee,
  startVerifyAll,
  getBatchProgress,
} from "@/services/credentialService";
export type ToolContext = { latestUserMessage: string };
type RegisteredTool = {
  definition: FunctionTool;
  label: string;
  run: (args: unknown, context: ToolContext) => Promise<unknown>;
};
function define<T extends z.ZodType>(
  name: string,
  description: string,
  label: string,
  schema: T,
  execute: (args: z.infer<T>, context: ToolContext) => Promise<unknown>,
): RegisteredTool {
  const json = z.toJSONSchema(schema);
  delete json.$schema;
  return {
    definition: {
      type: "function",
      name,
      description,
      strict: true,
      parameters: json,
    },
    label,
    run: async (args, context) => {
      const parsed = schema.safeParse(args);
      if (!parsed.success)
        return {
          ok: false,
          error: {
            code: "INVALID_ARGUMENTS",
            message: "Tool arguments did not pass validation.",
            issues: parsed.error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
        };
      return execute(parsed.data, context);
    },
  };
}
const text = z.string().trim().min(1).max(160);
const empty = z.strictObject({});
const registry: RegisteredTool[] = [
  define(
    "get_employee_by_name",
    "Find an employee by first and last name in the stored database. This is a lookup only and does not verify or recheck a license. If the user asked to verify, use the resolved employee ID with verify_employee_credential next. Returns candidates for ambiguous names; never silently selects among candidates.",
    "Looking up employee details",
    z.strictObject({ firstName: text, lastName: text }),
    async (a) =>
      matchEmployeeName(await listEmployees(), a.firstName, a.lastName),
  ),
  define(
    "search_employees",
    "Search stored employee names to resolve identity. This only reads the database; it does not verify a license. For a verification request, call verify_employee_credential with the resolved ID next. Partial matches are returned for clarification.",
    "Searching employee records",
    z.strictObject({ query: text }),
    async (a) => ({
      employees: searchEmployeesIn(await listEmployees(), a.query),
    }),
  ),
  define(
    "get_credentials_expiring_within_days",
    "Find expiration dates from today through N days inclusive. Excludes already expired licenses; reports stored verification state.",
    "Checking upcoming expirations",
    z.strictObject({ days: z.number().int().min(0).max(3650) }),
    async (a) => {
      const employees = await listEmployees();
      return {
        days: a.days,
        coverage: {
          totalEmployees: employees.length,
          unknownExpiration: employees.filter(
            (e) => e.daysUntilExpiration === null,
          ).length,
          unverified: employees.filter(
            (e) => e.verificationState === "UNVERIFIED",
          ).length,
        },
        employees: employees.filter(
          (e) =>
            e.daysUntilExpiration !== null &&
            e.daysUntilExpiration >= 0 &&
            e.daysUntilExpiration <= a.days,
        ),
      };
    },
  ),
  define(
    "get_expired_credentials",
    "Retrieve employees whose recorded license expiration date is before today.",
    "Checking expired credentials",
    empty,
    async () => ({
      employees: (await listEmployees()).filter(
        (e) => e.expirationCategory === "EXPIRED",
      ),
    }),
  ),
  define(
    "get_employees_by_manager",
    "Retrieve employees assigned to a manager. Match exact manager name first; ambiguous partial names require clarification.",
    "Reviewing manager assignments",
    z.strictObject({ managerName: text }),
    async (a) => {
      const employees = await listEmployees();
      const managers = [...new Set(employees.map((e) => e.manager))];
      const exact = managers.filter(
        (m) => m.toLowerCase() === a.managerName.toLowerCase(),
      );
      const matches = exact.length
        ? exact
        : managers.filter((m) =>
            m.toLowerCase().includes(a.managerName.toLowerCase()),
          );
      return matches.length === 1
        ? {
            manager: matches[0],
            employees: employees.filter((e) => e.manager === matches[0]),
          }
        : {
            clarificationRequired: matches.length > 1,
            candidates: matches,
            employees: [],
            message: matches.length
              ? "Please clarify the manager."
              : "Manager not found. Workbook spellings are preserved.",
          };
    },
  ),
  define(
    "get_unverified_employees",
    "Get employees in the UNVERIFIED state, who have not yet had a credential check.",
    "Finding unverified employees",
    empty,
    async () => ({
      employees: (await listEmployees()).filter(
        (e) => e.verificationState === "UNVERIFIED",
      ),
    }),
  ),
  define(
    "get_attention_needed",
    "Get expired or expiring within 30 days, review, not found, errors, and non-active source statuses. Includes attention reasons.",
    "Reviewing credentials needing attention",
    empty,
    async () => {
      const all = await listEmployees();
      const employees = all.filter(needsAttention);
      return {
        count: employees.length,
        coverage: {
          totalEmployees: all.length,
          unverified: all.filter((e) => e.verificationState === "UNVERIFIED")
            .length,
          unknownExpiration: all.filter((e) => e.daysUntilExpiration === null)
            .length,
        },
        employees,
      };
    },
  ),
  define(
    "get_credential_summary",
    "Return aggregate credential counts. Expiring windows are cumulative (7 is included in 14 and 30); source Active is independent of expiration category.",
    "Summarizing credential records",
    empty,
    async () => ({
      summary: summarize(await listEmployees()),
      verificationProgress: getBatchProgress(),
    }),
  ),
  define(
    "verify_employee_credential",
    "ACTION: Launch a fresh live Playwright browser verification of this employee's Michigan RN license against Michigan MILARA, exactly like clicking the manual Verify now/Reverify button. Use when asked to verify, reverify, recheck, or run a fresh/live license check, even if the employee was previously verified. Requires the employee ID from a lookup tool. Saves fresh source results and an audit/browser recording. This is not a database-only lookup. Fictional sample employees skip live checks.",
    "Verifying credential with Michigan MILARA",
    z.strictObject({ employeeId: text }),
    async (a) => {
      const startedAt = new Date().toISOString();
      const employee = await verifyEmployee(a.employeeId);
      return { ok: employee.verificationState === "VERIFIED", employee, recordingId: latestRecordingFor(a.employeeId, startedAt) };
    },
  ),
  define(
    "verify_all_credentials",
    "Start sequential verification for the entire fourth-worksheet roster. Returns STARTED and background progress.",
    "Starting sequential roster verification",
    empty,
    async () => {
      return { ok: true, action: "STARTED", progress: await startVerifyAll() };
    },
  ),
];
export const toolDefinitions = registry.map((t) => t.definition);
export const toolLabel = (name: string) =>
  registry.find((t) => t.definition.name === name)?.label ||
  "Reviewing credential records";
export async function executeTool(
  name: string,
  argumentsJson: string,
  context: ToolContext,
) {
  console.log("[AI] Calling tool:", name);
  const tool = registry.find((t) => t.definition.name === name);
  if (!tool)
    return {
      ok: false,
      error: { code: "UNKNOWN_TOOL", message: "Tool is not approved." },
    };
  try {
    const args: unknown = JSON.parse(argumentsJson);
    const result = await tool.run(args, context);
    console.log("[AI Tool]", name, "completed");
    return result;
  } catch (error) {
    console.error("[AI Tool]", name, error);
    return {
      ok: false,
      error: {
        code: "TOOL_FAILED",
        message:
          error instanceof SyntaxError
            ? "Tool arguments were not valid JSON."
            : "The credential tool could not complete. Please try again or use the dashboard.",
      },
    };
  }
}
