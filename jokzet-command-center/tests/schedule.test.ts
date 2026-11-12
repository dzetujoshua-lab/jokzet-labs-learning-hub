import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { generateInstances, listMissed, listToday, listUpcoming, reconcileMissed, setDailyStatus } from "@/lib/schedule/daily";
import { confirmImport, previewImport } from "@/lib/schedule/importer";
import { MAX_IMPORT_BYTES } from "@/lib/schedule/constants";
import { parseScheduleFile } from "@/lib/schedule/schema";
import { updateSettings } from "@/lib/schedule/settings";
import { startInstant, weekdayOf } from "@/lib/schedule/time";

const FIXTURE = readFileSync("tests/fixtures/schedule.json", "utf8");
const clone = () => JSON.parse(FIXTURE) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const text = (o: unknown) => JSON.stringify(o);

const MON = new Date("2026-11-16T10:00:00Z"); // Monday, the programme start day (Accra = UTC+0)
let userA = "";
let userB = "";

async function mkUser(email: string) {
  return (await db.user.create({ data: { email, passwordHash: "x" } })).id;
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "sched-test" } } });
  userA = await mkUser("sched-test-a@example.test");
  userB = await mkUser("sched-test-b@example.test");
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: "sched-test" } } });
  await db.$disconnect();
});

describe("JSON import validation", () => {
  it("accepts the supplied file and hashes it deterministically", () => {
    const a = parseScheduleFile(FIXTURE);
    const b = parseScheduleFile(JSON.stringify(JSON.parse(FIXTURE), null, 4)); // formatting must not matter
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.data.weeklyMissions).toHaveLength(7);
      expect(a.data.schedule.timezone).toBe("Africa/Accra");
      expect(a.hash).toBe(b.hash);
    }
  });

  it.each([
    ["empty input", () => "", /empty/i],
    ["malformed JSON", () => "{ nope", /not valid JSON/i],
    ["non-object", () => "[1,2,3]", /./],
    ["unsupported schemaVersion", () => text({ ...clone(), schemaVersion: "9.9" }), /schemaVersion/],
    ["six missions", () => { const o = clone(); o.weeklyMissions.pop(); return text(o); }, /seven/i],
    ["duplicate weekday", () => { const o = clone(); o.weeklyMissions[1].dayOfWeek = "MO"; return text(o); }, /Duplicate day/],
    ["duplicate id", () => { const o = clone(); o.weeklyMissions[1].id = o.weeklyMissions[0].id; return text(o); }, /Duplicate mission id/],
    ["bad time", () => { const o = clone(); o.weeklyMissions[0].startTime = "25:00"; return text(o); }, /HH:mm/],
    ["bad timezone", () => { const o = clone(); o.schedule.timezone = "Mars/Olympus"; return text(o); }, /timezone/i],
    ["impossible date", () => { const o = clone(); o.schedule.startDate = "2026-02-30"; return text(o); }, /calendar date/i],
    ["missing required field", () => { const o = clone(); delete o.weeklyMissions[2].objective; return text(o); }, /objective/],
    ["bad weekday code", () => { const o = clone(); o.weeklyMissions[0].dayOfWeek = "XX"; return text(o); }, /dayOfWeek/],
    ["unsupported trigger", () => { const o = clone(); o.schedule.notification.trigger = "before_end"; return text(o); }, /trigger/],
    ["oversized file", () => "x".repeat(MAX_IMPORT_BYTES + 1), /200 KB/],
  ])("rejects %s", (_name, make, message) => {
    const result = parseScheduleFile(make());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(message);
  });

  it("previews all seven missions, Monday first, without writing anything", async () => {
    const preview = await previewImport(userA, FIXTURE);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.status).toBe("new");
    expect(preview.missions.map((m) => m.dayLabel)).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    expect(preview.missions[0].startTime).toBe("12:00");
    expect(await db.scheduleConfig.count({ where: { userId: userA } })).toBe(0);
  });
});

describe("import, duplicate prevention and updates", () => {
  it("imports once and stores schedule, templates, settings and daily missions", async () => {
    const result = await confirmImport(userA, FIXTURE, MON);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("new");
    expect(await db.scheduleConfig.count({ where: { userId: userA } })).toBe(1);
    expect(await db.weeklyMissionTemplate.count({ where: { schedule: { userId: userA } } })).toBe(7);
    const settings = await db.reminderSettings.findUniqueOrThrow({ where: { userId: userA } });
    expect(settings.timezone).toBe("Africa/Accra");
    expect(settings.enabled).toBe(true);
    expect(settings.browserEnabled).toBe(false); // never on before an explicit permission grant
    expect(settings.advanceEnabled).toBe(false); // file says minutesBefore: 0
  });

  it("does not duplicate anything when the same file is imported again", async () => {
    const before = {
      schedules: await db.scheduleConfig.count({ where: { userId: userA } }),
      templates: await db.weeklyMissionTemplate.count({ where: { schedule: { userId: userA } } }),
      instances: await db.dailyMissionInstance.count({ where: { userId: userA } }),
    };
    const again = await confirmImport(userA, FIXTURE, MON);
    expect(again).toMatchObject({ ok: true, status: "unchanged", instancesCreated: 0 });
    const preview = await previewImport(userA, FIXTURE);
    expect(preview.ok && preview.status).toBe("unchanged");
    expect({
      schedules: await db.scheduleConfig.count({ where: { userId: userA } }),
      templates: await db.weeklyMissionTemplate.count({ where: { schedule: { userId: userA } } }),
      instances: await db.dailyMissionInstance.count({ where: { userId: userA } }),
    }).toEqual(before);
  });

  it("survives a double-click: two simultaneous imports still produce one schedule", async () => {
    const results = await Promise.allSettled([confirmImport(userB, FIXTURE, MON), confirmImport(userB, FIXTURE, MON)]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(await db.scheduleConfig.count({ where: { userId: userB } })).toBe(1);
    expect(await db.weeklyMissionTemplate.count({ where: { schedule: { userId: userB } } })).toBe(7);
  });

  it("updates changed content in place, keeps history and keeps the user's own settings", async () => {
    const inst = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-16T00:00:00Z") } });
    expect((await setDailyStatus(userA, inst.id, "COMPLETED", MON)).ok).toBe(true);
    await updateSettings(userA, { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: true, advanceMinutes: 30, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, MON);

    const edited = clone();
    edited.weeklyMissions[0].title = "Full-stack Development (edited)";
    edited.weeklyMissions[1].startTime = "09:30";
    const result = await confirmImport(userA, text(edited), MON);
    expect(result).toMatchObject({ ok: true, status: "update" });

    expect(await db.scheduleConfig.count({ where: { userId: userA } })).toBe(1);
    const templates = await db.weeklyMissionTemplate.findMany({ where: { schedule: { userId: userA } } });
    expect(templates).toHaveLength(7);
    expect(templates.find((t) => t.key === "monday-fullstack")?.title).toContain("(edited)");

    // Completed history is untouched, future Tuesday moved to the new time, user's advance setting preserved.
    expect((await db.dailyMissionInstance.findUniqueOrThrow({ where: { id: inst.id } })).status).toBe("COMPLETED");
    const tuesday = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-17T00:00:00Z") } });
    expect(tuesday.startAt.toISOString()).toBe("2026-11-17T09:30:00.000Z");
    expect((await db.reminderSettings.findUniqueOrThrow({ where: { userId: userA } })).advanceMinutes).toBe(30);

    await confirmImport(userA, FIXTURE, MON); // restore for later tests
  });
});

describe("weekly mission generation (programme starts 16 Nov 2026)", () => {
  it("assigns the correct mission to each weekday and repeats weekly", async () => {
    const rows = await db.dailyMissionInstance.findMany({ where: { userId: userA }, include: { template: true }, orderBy: { date: "asc" } });
    const keyFor = (iso: string) => rows.find((r) => r.date.toISOString().slice(0, 10) === iso)?.template.key;
    expect(weekdayOf("2026-11-16")).toBe(1); // sanity: a Monday
    expect(keyFor("2026-11-16")).toBe("monday-fullstack");
    expect(keyFor("2026-11-17")).toBe("tuesday-uiux");
    expect(keyFor("2026-11-18")).toBe("wednesday-cybersecurity");
    expect(keyFor("2026-11-19")).toBe("thursday-cloud-servers");
    expect(keyFor("2026-11-20")).toBe("friday-ai-business");
    expect(keyFor("2026-11-21")).toBe("saturday-photo-video");
    expect(keyFor("2026-11-22")).toBe("sunday-review");
    expect(keyFor("2026-11-23")).toBe("monday-fullstack"); // recurs
    expect(rows[0].date.toISOString().slice(0, 10)).toBe("2026-11-16"); // nothing before the start date
  });

  it("generates a rolling 28-day window and is idempotent", async () => {
    const count = await db.dailyMissionInstance.count({ where: { userId: userA } });
    expect(count).toBe(29); // 16 Nov .. 14 Dec inclusive
    expect(await generateInstances(userA, MON)).toBe(0);
    expect(await db.dailyMissionInstance.count({ where: { userId: userA } })).toBe(count);
    // A week later the window extends by seven days, never duplicating.
    expect(await generateInstances(userA, new Date("2026-11-23T10:00:00Z"))).toBe(7);
  });

  it("shows today's mission and upcoming missions", async () => {
    const today = await listToday(userA, MON);
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ templateKey: "monday-fullstack", date: "2026-11-16", time: "12:00", durationMinutes: 60 });
    const upcoming = await listUpcoming(userA, MON, 3);
    expect(upcoming.map((u) => u.date)).toEqual(["2026-11-17", "2026-11-18", "2026-11-19"]);
  });

  it("generates nothing before the programme starts except the future window", async () => {
    const early = new Date("2026-11-11T10:00:00Z");
    expect((await listToday(userA, early))).toHaveLength(0);
    // Mon 16 Nov was completed by an earlier test, so it is correctly not "upcoming"; the next scheduled days are.
    const dates = (await listUpcoming(userA, early, 2)).map((u) => u.date);
    expect(dates).toEqual(["2026-11-17", "2026-11-18"]);
    expect(dates.every((d) => d >= "2026-11-16")).toBe(true); // nothing before the programme start
  });
});

describe("Africa/Accra and other timezones", () => {
  it("Accra is UTC+0: 12:00 local is 12:00Z", () => {
    expect(startInstant("2026-11-16", "12:00", "Africa/Accra").toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });

  it("converts correctly for other zones, including DST", () => {
    expect(startInstant("2026-11-16", "12:00", "America/New_York").toISOString()).toBe("2026-11-16T17:00:00.000Z"); // EST
    expect(startInstant("2026-07-16", "12:00", "America/New_York").toISOString()).toBe("2026-07-16T16:00:00.000Z"); // EDT
    expect(startInstant("2026-11-16", "12:00", "Asia/Tokyo").toISOString()).toBe("2026-11-16T03:00:00.000Z");
  });

  it("uses the local calendar day for 'today', not the UTC day", async () => {
    await updateSettings(userB, { enabled: true, reminderTime: "", timezone: "Asia/Tokyo", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, MON);
    const lateMonday = new Date("2026-11-16T23:30:00Z"); // already Tuesday 08:30 in Tokyo
    const today = await listToday(userB, lateMonday);
    expect(today[0]?.templateKey).toBe("tuesday-uiux");
    expect(today[0]?.startAt).toBe("2026-11-17T03:00:00.000Z");
    await updateSettings(userB, { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, MON);
  });

  it("moves future due times when the reminder time or timezone changes", async () => {
    await updateSettings(userA, { enabled: true, reminderTime: "08:15", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, MON);
    const wed = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-18T00:00:00Z") } });
    expect(wed.startAt.toISOString()).toBe("2026-11-18T08:15:00.000Z");
    expect((await updateSettings(userA, { enabled: true, reminderTime: "25:61", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false })).ok).toBe(false);
    expect((await updateSettings(userA, { enabled: true, reminderTime: "", timezone: "Not/AZone", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false })).ok).toBe(false);
    await updateSettings(userA, { enabled: true, reminderTime: "", timezone: "Africa/Accra", advanceEnabled: false, advanceMinutes: 15, inAppEnabled: true, browserEnabled: false, pushEnabled: false }, MON);
  });
});

describe("mission completion tracking and missed missions", () => {
  it("records every transition, in order, and blocks invalid ones", async () => {
    const tuesday = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-17T00:00:00Z") } });
    const tueNow = new Date("2026-11-17T13:00:00Z");

    expect(await setDailyStatus(userA, tuesday.id, "SCHEDULED" as never, tueNow)).toMatchObject({ ok: false });
    expect(await setDailyStatus(userA, tuesday.id, "STARTED", tueNow)).toEqual({ ok: true });
    expect(await setDailyStatus(userA, tuesday.id, "STARTED", tueNow)).toEqual({ ok: true }); // no-op, no extra record
    expect(await setDailyStatus(userA, tuesday.id, "AWAITING_ASSESSMENT", tueNow)).toEqual({ ok: true });
    expect(await setDailyStatus(userA, tuesday.id, "COMPLETED", tueNow)).toEqual({ ok: true });
    expect(await setDailyStatus(userA, tuesday.id, "STARTED", tueNow)).toMatchObject({ ok: false }); // already completed

    const records = await db.missionCompletionRecord.findMany({ where: { instanceId: tuesday.id }, orderBy: { occurredAt: "asc" } });
    expect(records.map((r) => `${r.fromStatus}>${r.toStatus}`)).toEqual(["SCHEDULED>STARTED", "STARTED>AWAITING_ASSESSMENT", "AWAITING_ASSESSMENT>COMPLETED"]);
    const row = await db.dailyMissionInstance.findUniqueOrThrow({ where: { id: tuesday.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.startedAt && row.submittedAt && row.completedAt).toBeTruthy();
  });

  it("refuses to advance a mission that is not due yet", async () => {
    const friday = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-20T00:00:00Z") } });
    expect(await setDailyStatus(userA, friday.id, "COMPLETED", MON)).toEqual({ ok: false, error: "This mission is not due yet." });
  });

  it("never lets another user change someone else's mission", async () => {
    const wed = await db.dailyMissionInstance.findFirstOrThrow({ where: { userId: userA, date: new Date("2026-11-18T00:00:00Z") } });
    expect(await setDailyStatus(userB, wed.id, "COMPLETED", new Date("2026-11-18T13:00:00Z"))).toEqual({ ok: false, error: "Mission not found." });
    expect((await db.dailyMissionInstance.findUniqueOrThrow({ where: { id: wed.id } })).status).toBe("SCHEDULED");
  });

  it("marks unfinished past missions as MISSED once, keeps them reviewable, and allows a late completion", async () => {
    const now = new Date("2026-11-20T10:00:00Z"); // Friday: Mon is complete (earlier test), Tue complete, Wed/Thu not
    const first = await reconcileMissed(userA, now);
    expect(first).toBeGreaterThanOrEqual(2); // Wed + Thu (+ any other unfinished earlier day)
    expect(await reconcileMissed(userA, now)).toBe(0); // idempotent

    const missed = await listMissed(userA);
    expect(missed.map((m) => m.date)).toContain("2026-11-18");
    expect(missed.every((m) => m.status === "MISSED")).toBe(true);
    const recs = await db.missionCompletionRecord.count({ where: { userId: userA, toStatus: "MISSED" } });
    expect(recs).toBe(first);

    const wed = missed.find((m) => m.date === "2026-11-18")!;
    expect(await setDailyStatus(userA, wed.id, "COMPLETED", now)).toEqual({ ok: true });
    const late = await db.missionCompletionRecord.findFirstOrThrow({ where: { instanceId: wed.id, toStatus: "COMPLETED" } });
    expect(late.fromStatus).toBe("MISSED");
    expect(late.note).toMatch(/late/i);
    expect((await listMissed(userA)).some((m) => m.id === wed.id)).toBe(false);
  });
});
