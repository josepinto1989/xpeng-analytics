export const TUTORIAL_STORAGE_KEY = "xpeng-analytics-tutorial-v1";

export const tutorialStates = Object.freeze({
  NEW: "new",
  LANDING_COMPLETE: "landing-complete",
  COMPLETE: "complete",
  DISMISSED: "dismissed",
});

const validStates = new Set(Object.values(tutorialStates));

export function readTutorialState(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(TUTORIAL_STORAGE_KEY);
    return validStates.has(value) ? value : tutorialStates.NEW;
  } catch {
    return tutorialStates.NEW;
  }
}

export function writeTutorialState(value, storage = globalThis.localStorage) {
  const next = validStates.has(value) ? value : tutorialStates.NEW;
  try { storage?.setItem(TUTORIAL_STORAGE_KEY, next); } catch { /* Local preference only. */ }
  return next;
}

export function nextTutorialMode(state, hasData, dashboardEligible = true) {
  if (state === tutorialStates.COMPLETE || state === tutorialStates.DISMISSED) return null;
  if (hasData) return dashboardEligible ? "dashboard" : null;
  return state === tutorialStates.NEW ? "landing" : null;
}

export function shouldShowDashboardTutorialForHistory(sourceVersion) {
  const version = Number(sourceVersion);
  return Number.isInteger(version) && version > 0 && version <= 3;
}

export function completeTutorialMode(mode) {
  return mode === "landing" ? tutorialStates.LANDING_COMPLETE : tutorialStates.COMPLETE;
}
