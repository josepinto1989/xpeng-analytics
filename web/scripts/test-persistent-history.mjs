import { formatStoredBytes, latestImportAt, nextReminderAt, reminderDue } from "../src/persistent-history.js";

const snapshot = {
  imports: [
    { completedAtUtc: "2026-08-01T10:00:00.000Z" },
    { completedAtUtc: "2026-10-01T10:00:00.000Z" },
    { completedAtUtc: null },
  ],
};

if (latestImportAt(snapshot) !== "2026-10-01T10:00:00.000Z") throw new Error("Latest import timestamp was not selected");
if (reminderDue("2026-10-01T10:00:00.000Z", true, 30, Date.parse("2026-10-31T10:00:00.000Z")) !== true) throw new Error("Thirty-day reminder should be due");
if (reminderDue("2026-10-01T10:00:00.000Z", true, 7, Date.parse("2026-10-08T10:00:00.000Z")) !== true) throw new Error("Seven-day reminder should be due");
if (reminderDue("2026-10-01T10:00:00.000Z", true, 15, Date.parse("2026-10-15T10:00:00.000Z")) !== false) throw new Error("Fifteen-day reminder triggered early");
if (reminderDue("2026-10-01T10:00:00.000Z", false, 30, Date.parse("2026-12-01T10:00:00.000Z")) !== false) throw new Error("Disabled reminder must stay hidden");
if (reminderDue("invalid", true, 30, Date.now()) !== false) throw new Error("Invalid timestamps must not trigger reminders");
if (nextReminderAt("2026-10-01T10:00:00.000Z", 25) !== "2026-10-26T10:00:00.000Z") throw new Error("Next reminder date is incorrect");
if (nextReminderAt("2026-10-01T10:00:00.000Z", 12) !== null) throw new Error("Unsupported reminder interval must be rejected");
if (formatStoredBytes(12 * 1024 * 1024, "en") !== "12 MB") throw new Error("Stored byte formatter returned an unexpected value");

console.log("Persistent history helpers passed.");
