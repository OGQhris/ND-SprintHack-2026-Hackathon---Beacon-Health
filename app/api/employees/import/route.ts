import { guardOrigin, safeError } from "@/lib/http";
import {
  CSV_MAX_BYTES,
  CsvImportError,
  importEmployeeCsv,
} from "@/services/csvImport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_NAME = /\.csv$/i;
/** Browsers label CSVs inconsistently; Windows often says vnd.ms-excel and some send no type at all. */
const CSV_TYPES = new Set([
  "",
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
]);
/** The file plus multipart framing; anything bigger is refused before it is buffered. */
const BODY_CAP = CSV_MAX_BYTES + 250_000;

/** Reads at most BODY_CAP bytes; null when the body is larger (chunked uploads carry no Content-Length). */
async function readCapped(
  request: Request,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(new ArrayBuffer(0));
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > BODY_CAP) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(size));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** UTF-8 first; UTF-16 when the file says so; Excel on Windows still writes cp1252, which is the fallback. */
function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const reject = (error: string, status: number) =>
  Response.json({ error }, { status });

/**
 * multipart/form-data: `file` (the CSV) and `verify` ("true" starts a roster check for the new people).
 * Answers 201 with `{ result }` (see EmployeeImportResult); nothing is written when the file is rejected.
 */
export async function POST(request: Request) {
  const denied = guardOrigin(request);
  if (denied) return denied;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > BODY_CAP) return reject("That file is larger than 1 MB.", 413);

  let form: FormData;
  try {
    const body = await readCapped(request);
    if (!body) return reject("That file is larger than 1 MB.", 413);
    form = await new Response(body, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return reject("Send the CSV as a file upload.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return reject("Choose a .csv file.", 400);
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (!CSV_NAME.test(file.name) || !CSV_TYPES.has(type))
    return reject("Choose a .csv file.", 400);
  if (file.size === 0) return reject("That file is empty.", 400);
  if (file.size > CSV_MAX_BYTES)
    return reject("That file is larger than 1 MB.", 413);

  try {
    const result = await importEmployeeCsv({
      fileName: file.name,
      text: decode(new Uint8Array(await file.arrayBuffer())),
      verify: form.get("verify") === "true",
    });
    return Response.json({ result }, { status: 201 });
  } catch (e) {
    if (e instanceof CsvImportError) return reject(e.message, e.status);
    return safeError(e, "The import could not be completed. Please try again.");
  }
}
