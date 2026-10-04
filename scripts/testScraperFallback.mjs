import { chromium } from "playwright";
import assert from "node:assert/strict";
import {
  readDetail,
  selectRnLicenseType,
} from "../services/credentialProviders/michiganRnPlaywrightProvider.ts";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(
    '<select id="ctl00_PlaceHolderMain_refLicenseeSearchForm_ddlLicenseType"><option value="">All</option><option>Licensed Practical Nurse</option><option>Registered Nurse</option><option>Registered Nurse Temporary</option></select>',
  );
  await selectRnLicenseType(page);
  assert.equal(await page.locator("select").inputValue(), "Registered Nurse");
  const fields = {
    "License Type": "Registered Nurse",
    "License Number": "fixture-123",
    Name: "Test Registered Nurse",
    "License Issue Date": "03/04/2020",
    "License Expiration Date": "03/04/2028",
    "License Status": "Active",
    County: "Kalamazoo",
  };
  await page.setContent(
    "<table>" +
      Object.entries(fields)
        .map(
          ([label, value]) =>
            `<tr><td><span>${label}:</span></td><td><span>${value}</span></td></tr>`,
        )
        .join("") +
      "</table>",
  );
  assert.deepEqual(await readDetail(page), fields);
  await page.setContent(
    "<dl>" +
      Object.entries(fields)
        .map(([label, value]) => `<dt>${label}:</dt><dd>${value}</dd>`)
        .join("") +
      "</dl>",
  );
  assert.deepEqual(await readDetail(page), fields);
  await page.setContent("<div><span>License Number:</span> fixture-456</div>");
  assert.equal((await readDetail(page))["License Number"], "fixture-456");
  console.log(
    "PASS: search selects Registered Nurse exactly; detail fallback reads table cells, definition lists, and inline labels without stable IDs.",
  );
} finally {
  await browser.close();
}
