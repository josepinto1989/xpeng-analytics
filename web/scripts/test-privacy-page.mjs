import { readFile } from "node:fs/promises";

const [privacy, about, app, dashboard] = await Promise.all([
  readFile(new URL("../public/privacy.html", import.meta.url), "utf8"),
  readFile(new URL("../public/about.html", import.meta.url), "utf8"),
  readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/Dashboard.jsx", import.meta.url), "utf8"),
]);

const requiredDisclosures = [
  "Local processing",
  "Optional Google Drive backup",
  "drive.file",
  "Google access tokens remain in the current tab's memory",
  "does not sell, share or transfer Google user data",
  "Deleting your data",
  "open an issue on GitHub",
];

for (const disclosure of requiredDisclosures) {
  if (!privacy.includes(disclosure)) {
    throw new Error(`Privacy page is missing required disclosure: ${disclosure}`);
  }
}

for (const [name, source] of [["landing", app], ["dashboard", dashboard]]) {
  if (!source.includes("privacy.html")) {
    throw new Error(`${name} footer does not link to the privacy policy`);
  }
  if (!source.includes("about.html")) {
    throw new Error(`${name} footer does not link to the about page`);
  }
  if (source.includes("logboox.app")) {
    throw new Error(`${name} still contains the removed LogbooX website link`);
  }
}

for (const message of ["Understand your car through your own data", "how much energy does it consume", "Your data stays under your control", "independent community project"]) {
  if (!about.includes(message)) throw new Error(`About page is missing expected content: ${message}`);
}

console.log("Public privacy/about pages and application links passed.");
