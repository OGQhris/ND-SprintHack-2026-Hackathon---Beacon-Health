import type { VerificationRecorder } from "../verificationRecorder";
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { candidateFromFields, classifyCandidates } from "./michiganParser";
import {
  MICHIGAN_URL,
  type CredentialProvider,
  type CredentialVerificationResult,
} from "./types";
export const cleanSourceText = (value: string) =>
  value
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const detailFields: Record<string, string> = {
  "License Type": "lblLicenseeType_value",
  "License Number": "lblLicenseeNumber_value",
  Name: "lblContactName_value",
  "License Issue Date": "lblLicenseIssueDate_value",
  "License Expiration Date": "lblExpirationDate_value",
  "License Status": "lblBusinessName2_value",
  County: "lblInsuranceCompany_value",
};
async function fillName(
  page: Page,
  label: string,
  fieldId: string,
  value: string,
  recorder?: VerificationRecorder,
) {
  const accessible = page.getByLabel(label, { exact: true });
  const field = (await accessible.count())
    ? accessible
    : page.locator(`#ctl00_PlaceHolderMain_refLicenseeSearchForm_${fieldId}`);
  await field.scrollIntoViewIfNeeded();
  await recorder?.capture(
    page,
    `Entering ${label.replace(":", "").toLowerCase()}: ${value}`,
    "type",
    field,
  );
  await field.fill(value);
  await recorder?.capture(
    page,
    `${label.replace(":", "")} entered`,
    "read",
    field,
  );
}
export async function selectRnLicenseType(
  page: Page,
  recorder?: VerificationRecorder,
) {
  const licenseType = page.locator(
    "#ctl00_PlaceHolderMain_refLicenseeSearchForm_ddlLicenseType",
  );
  if (await licenseType.count()) {
    await recorder?.capture(
      page,
      "Filtering to Registered Nurse licenses",
      "click",
      licenseType,
    );
    await licenseType.selectOption({ label: "Registered Nurse" });
  }
}
export async function readDetail(page: Page) {
  const fields: Record<string, string> = {};
  for (const [key, id] of Object.entries(detailFields)) {
    const el = page.locator(`#ctl00_PlaceHolderMain_licenseeGeneralInfo_${id}`);
    fields[key] = (await el.count())
      ? cleanSourceText(await el.innerText())
      : "";
  }
  if (Object.values(fields).some((value) => !value)) {
    const fallback = await page.evaluate(() => {
      const result: Record<string, string> = {};
      const labels = [
        "License Type",
        "License Number",
        "Name",
        "License Issue Date",
        "License Expiration Date",
        "License Status",
        "County",
      ];
      for (const label of labels) {
        const nodes = Array.from(
          document.querySelectorAll("td,th,dt,label,span,strong"),
        );
        const match = nodes.find(
          (el) =>
            (el.textContent || "")
              .replace(/[\u200B-\u200D\uFEFF]/g, "")
              .replace(/\s+/g, " ")
              .trim()
              .replace(/:$/, "")
              .toLowerCase() === label.toLowerCase(),
        );
        if (!match) continue;
        const cell = match.closest("td,th,dt");
        const sibling = match.nextElementSibling || cell?.nextElementSibling;
        let value = (sibling?.textContent || "")
          .replace(/[\u200B-\u200D\uFEFF]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!value && match.parentElement)
          value = (match.parentElement.textContent || "")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "");
        if (value && value.toLowerCase() !== label.toLowerCase())
          result[label] = value;
      }
      return result;
    });
    for (const label of Object.keys(detailFields))
      if (!fields[label])
        fields[label] = cleanSourceText(fallback[label] || "");
  }
  return fields;
}
export class MichiganRNPlaywrightProvider implements CredentialProvider {
  async verify(
    employee: {
      firstName: string;
      lastName: string;
      id?: string;
    },
    recorder?: VerificationRecorder,
  ): Promise<CredentialVerificationResult> {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let page: Page | undefined;
    try {
      browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
      });
      page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(30_000);
      console.log("[Playwright] Opening Michigan MILARA");
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await page.goto(MICHIGAN_URL, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        if (!response || response.status() < 500) break;
        if (attempt === 1)
          throw new Error(
            `Michigan MILARA returned HTTP ${response.status()}.`,
          );
        console.log(
          "[Playwright] State source temporarily unavailable; retrying once",
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await recorder?.capture(
        page,
        "Opened Michigan MILARA licensing search",
        "navigate",
      );
      await selectRnLicenseType(page, recorder);
      console.log("[Playwright] Filling First Name:", employee.firstName);
      await fillName(
        page,
        "First Name:",
        "txtFirstName",
        employee.firstName,
        recorder,
      );
      console.log("[Playwright] Filling Last Name:", employee.lastName);
      await fillName(
        page,
        "Last Name:",
        "txtLastName",
        employee.lastName,
        recorder,
      );
      await recorder?.capture(
        page,
        "Clicking Search",
        "click",
        page.getByRole("link", { name: "Search", exact: true }),
      );
      await Promise.all([
        page.waitForLoadState("domcontentloaded"),
        page.getByRole("link", { name: "Search", exact: true }).click(),
      ]);
      console.log("[Playwright] Search submitted");
      await page.waitForFunction(
        () => {
          if (!document.body) return false;
          const text = document.body.innerText.replace(
            /[\u200B-\u200D\uFEFF]/g,
            "",
          );
          return (
            !!document.querySelector(
              "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeType_value",
            ) ||
            (/License Issue Date/i.test(text) &&
              /License Expiration Date/i.test(text)) ||
            /no records|no results|no matching|results found matching|licensee list|licensee information|search results|bad gateway|service unavailable|error code 50[234]/i.test(
              text,
            ) ||
            !!document.querySelector(
              "#ctl00_PlaceHolderMain_refLicenseeList_gdvRefLicenseeList",
            )
          );
        },
        undefined,
        { timeout: 30_000 },
      );
      await recorder?.capture(page, "Reading state licensing results", "read");
      const sourceBody = cleanSourceText(
        await page.locator("body").innerText(),
      );
      if (
        /bad gateway|service unavailable|error code 50[234]/i.test(sourceBody)
      )
        throw new Error("Michigan MILARA returned a temporary server error.");
      const initialDetail = await readDetail(page);
      if (
        initialDetail["License Number"] &&
        initialDetail["License Expiration Date"]
      ) {
        await recorder?.capture(
          page,
          "Reading license details",
          "read",
          (await page
            .locator(
              "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeNumber_value",
            )
            .count())
            ? page.locator(
                "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeNumber_value",
              )
            : undefined,
        );
        const fields = await readDetail(page);
        console.log("[Playwright] Result found");
        return classifyCandidates(
          [candidateFromFields(fields, page.url())],
          employee,
          fields,
        );
      }
      const body = cleanSourceText(await page.locator("body").innerText());
      if (/no records|no results|no matching/i.test(body))
        return classifyCandidates([], employee, { message: body.slice(-3000) });
      const grid = page.locator(
        "#ctl00_PlaceHolderMain_refLicenseeList_gdvRefLicenseeList",
      );
      if (!(await grid.count()))
        throw new Error("The source returned an unrecognized result layout.");
      const extracted = await grid.evaluate((table) => {
        const rows = Array.from(table.querySelectorAll(":scope > tbody > tr"));
        const header = rows.find((r) => r.querySelector("th"));
        const keys = header
          ? Array.from(header.querySelectorAll("th")).map((el) =>
              (el.textContent || "").trim(),
            )
          : [];
        return rows
          .filter(
            (r) =>
              r.className.includes("ACA_TabRow_") && !r.querySelector("th"),
          )
          .map((row) => {
            const values = Array.from(row.querySelectorAll(":scope > td")).map(
              (el) => (el.textContent || "").trim(),
            );
            return Object.fromEntries(
              keys.map((key, i) => [key, values[i] || ""]),
            );
          });
      });
      const candidates = extracted.map((raw) => {
        const fields = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, cleanSourceText(v)]),
        );
        fields.Name = [
          fields["First Name"],
          fields["Middle Initial"],
          fields["Last Name"],
        ]
          .filter(Boolean)
          .join(" ");
        return candidateFromFields(fields);
      });
      const showing = body.match(/Showing\s+(\d+)-(\d+)\s+of\s+(\d+)/i);
      const complete = !!showing && Number(showing[2]) === Number(showing[3]);
      const result = classifyCandidates(
        candidates,
        employee,
        extracted,
        complete,
      );
      if (result.state === "VERIFIED" && result.credential?.licenseNumber) {
        const number = result.credential.licenseNumber;
        await recorder?.capture(
          page,
          `Opening license ${number}`,
          "click",
          grid.getByRole("link", { name: number, exact: true }),
        );
        await grid.getByRole("link", { name: number, exact: true }).click();
        await page.waitForFunction(
          () =>
            !!document.querySelector(
              "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeType_value",
            ) ||
            (/License Issue Date/i.test(document.body?.innerText || "") &&
              /License Expiration Date/i.test(document.body?.innerText || "")),
        );
        await recorder?.capture(
          page,
          "Reading license details",
          "read",
          (await page
            .locator(
              "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeNumber_value",
            )
            .count())
            ? page.locator(
                "#ctl00_PlaceHolderMain_licenseeGeneralInfo_lblLicenseeNumber_value",
              )
            : undefined,
        );
        const detail = await readDetail(page);
        return classifyCandidates(
          [candidateFromFields(detail, page.url())],
          employee,
          { searchRows: extracted, detail },
        );
      }
      return result;
    } catch (error) {
      console.error(
        "[Playwright] Verification failed",
        error instanceof Error ? error.message : "Unknown failure",
      );
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const identifier = (
        employee.id || `${employee.firstName}-${employee.lastName}`
      ).replace(/[^a-z0-9_-]/gi, "-");
      let screenshotPath: string | undefined;
      if (page) {
        await recorder?.capture(page, "Source check interrupted", "result");
        try {
          await mkdir("debug", { recursive: true });
          screenshotPath = `debug/${identifier}-${stamp}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          screenshotPath = undefined;
        }
      }
      return {
        state: "ERROR",
        source: "Michigan MILARA",
        sourceUrl: MICHIGAN_URL,
        checkedAt: new Date().toISOString(),
        credential: null,
        candidates: [],
        rawFields: {
          failure:
            error instanceof Error ? error.message : "Unknown browser failure",
        },
        error:
          "Michigan MILARA could not be checked. The site may be unavailable or its layout may have changed. Please retry or review the source manually.",
        screenshotPath,
      };
    } finally {
      await browser?.close();
    }
  }
}
export async function verifyMichiganRN(employee: {
  firstName: string;
  lastName: string;
}) {
  return new MichiganRNPlaywrightProvider().verify(employee);
}
