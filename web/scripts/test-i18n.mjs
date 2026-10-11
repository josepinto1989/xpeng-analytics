import { translations } from "../src/i18n.js";

const requiredLocales = ["pt-PT", "en"];
const referenceKeys = Object.keys(translations[requiredLocales[0]]).sort();
for (const locale of requiredLocales) {
  if (!translations[locale]) throw new Error(`Missing required locale: ${locale}`);
  const keys = Object.keys(translations[locale]).sort();
  if (JSON.stringify(keys) !== JSON.stringify(referenceKeys)) {
    const missing = referenceKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !referenceKeys.includes(key));
    throw new Error(`${locale} translation mismatch; missing=${missing.join(",")} extra=${extra.join(",")}`);
  }
  for (const key of keys) {
    if (!String(translations[locale][key]).trim()) throw new Error(`Empty translation: ${locale}.${key}`);
  }
}

console.log(`Translation parity passed (${requiredLocales.join(", ")}; ${referenceKeys.length} keys).`);
