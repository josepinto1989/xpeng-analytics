const text = (value, max = 80) => String(value ?? "").trim().slice(0, max);
const rows = (value) => Array.isArray(value) ? value : [];
const allowedJourneyKinds = new Set(["personal", "business", "commute", "custom"]);
const allowedChargeCategories = new Set(["home", "work", "public", "custom"]);
const allowedCurrencies = new Set(["EUR", "GBP", "USD", "NOK", "SEK", "DKK", "CHF", "PLN", "CZK"]);

export const JOURNEY_LABELS = ["personal", "business", "commute", "custom"];
export const CHARGE_CATEGORIES = ["home", "work", "public", "custom"];
export const TARIFF_CURRENCIES = [...allowedCurrencies];

export function emptyOwnershipMetadata() {
  return { journeyLabels: [], chargeCategories: [], tariffs: [], activeTariffId: "" };
}

export function validateOwnershipMetadata(value) {
  const input = value && typeof value === "object" ? value : {};
  const unique = (items, mapper, limit) => {
    const output = [], seen = new Set();
    for (const item of rows(items).slice(0, limit)) {
      const mapped = mapper(item);
      if (!mapped?.id || seen.has(mapped.id)) continue;
      seen.add(mapped.id); output.push(mapped);
    }
    return output;
  };
  const journeyLabels = unique(input.journeyLabels, (item) => {
    const id = text(item?.id, 160), kind = allowedJourneyKinds.has(item?.kind) ? item.kind : "personal";
    return id ? { id, kind, label: text(item?.label) } : null;
  }, 20_000);
  const chargeCategories = unique(input.chargeCategories, (item) => {
    const id = text(item?.id, 160), category = allowedChargeCategories.has(item?.category) ? item.category : "home";
    return id ? { id, category, label: text(item?.label) } : null;
  }, 20_000);
  const tariffs = unique(input.tariffs, (item) => {
    const id = text(item?.id, 80), pricePerKwh = Number(item?.pricePerKwh);
    if (!id || !Number.isFinite(pricePerKwh) || pricePerKwh < 0 || pricePerKwh > 100) return null;
    return { id, name: text(item?.name) || "Tariff", pricePerKwh, currency: allowedCurrencies.has(item?.currency) ? item.currency : "EUR" };
  }, 12);
  const activeTariffId = tariffs.some((item) => item.id === input.activeTariffId) ? input.activeTariffId : tariffs[0]?.id || "";
  return { journeyLabels, chargeCategories, tariffs, activeTariffId };
}

export function ownershipMaps(value) {
  const ownership = validateOwnershipMetadata(value);
  return {
    ownership,
    journeys: new Map(ownership.journeyLabels.map((item) => [item.id, item])),
    charges: new Map(ownership.chargeCategories.map((item) => [item.id, item])),
    activeTariff: ownership.tariffs.find((item) => item.id === ownership.activeTariffId) || null,
  };
}

export function chargeEstimatedCost(charge, tariff) {
  const energy = Number(charge?.wallEnergyKwh), price = Number(tariff?.pricePerKwh);
  return Number.isFinite(energy) && Number.isFinite(price) ? Math.max(0, energy) * Math.max(0, price) : null;
}

export function upsertJourneyLabel(value, id, kind, label = "") {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160);
  const next = current.journeyLabels.filter((item) => item.id !== cleanId);
  if (cleanId && allowedJourneyKinds.has(kind)) next.push({ id: cleanId, kind, label: text(label) });
  return validateOwnershipMetadata({ ...current, journeyLabels: next });
}

export function upsertChargeCategory(value, id, category, label = "") {
  const current = validateOwnershipMetadata(value), cleanId = text(id, 160);
  const next = current.chargeCategories.filter((item) => item.id !== cleanId);
  if (cleanId && allowedChargeCategories.has(category)) next.push({ id: cleanId, category, label: text(label) });
  return validateOwnershipMetadata({ ...current, chargeCategories: next });
}
