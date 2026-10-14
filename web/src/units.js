const MI_PER_KM = 0.621371192237334;
const PSI_PER_KPA = 0.1450377377;

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function distanceValue(value, system = "metric") {
  const number = finite(value);
  return number == null ? null : system === "imperial" ? number * MI_PER_KM : number;
}

export function distanceUnit(system = "metric") {
  return system === "imperial" ? "mi" : "km";
}

export function speedValue(value, system = "metric") {
  return distanceValue(value, system);
}

export function speedUnit(system = "metric") {
  return system === "imperial" ? "mph" : "km/h";
}

export function consumptionValue(value, system = "metric") {
  const number = finite(value);
  if (number == null) return null;
  return system === "imperial" ? (number > 0 ? 62.1371192237334 / number : null) : number;
}

export function consumptionUnit(system = "metric") {
  return system === "imperial" ? "mi/kWh" : "kWh/100 km";
}

export function temperatureValue(value, system = "metric") {
  const number = finite(value);
  return number == null ? null : system === "imperial" ? number * 9 / 5 + 32 : number;
}

export function temperatureUnit(system = "metric") {
  return system === "imperial" ? "°F" : "°C";
}

export function pressureValue(value, unit = "bar") {
  const number = finite(value);
  if (number == null) return null;
  return unit === "psi" ? number * PSI_PER_KPA : number / 100;
}

export function pressureUnitLabel(unit = "bar") {
  return unit === "psi" ? "psi" : "bar";
}
