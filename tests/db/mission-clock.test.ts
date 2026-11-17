import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootDatabase, as, travel, HOST, OVERRIDER, OWNER, STRANGER } from "./harness";

type Clock = {
  state: string;
  duration_seconds: number;
  started_at: Date | null;
  ends_at: Date | null;
  completed_at: Date | null;
  version: number;
  server_now: Date;
  held_remaining_ms: number | null;
};

let db: PGlite;
let eventId: string;

const host = { role: "authenticated" as const, sub: HOST };
const start = () => as<Clock>(db, host, "select * from public.start_mission($1)", [eventId]);
const read = () => as<Clock>(db, { role: "anon" }, "select * from public.mission_clock where event_id = $1", [eventId]);
const audit = async () => (await db.query<{ action: string; reason: string | null; details: unknown }>(
  "select action, reason, details from public.timer_audit_log where event_id = $1 order by id", [eventId])).rows;

beforeEach(async () => {
  ({ db, eventId } = await bootDatabase());
});

describe("starting the mission", () => {
  it("1. starts at exactly 12 hours (43,200 s) from the database clock", async () => {
    const before = (await read()).rows[0];
    expect(before.state).toBe("NOT_STARTED");
    expect(before.duration_seconds).toBe(43200);

    const row = (await start()).rows[0];
    expect(row.state).toBe("RUNNING");
    expect(row.ends_at!.getTime() - row.started_at!.getTime()).toBe(43_200_000);
    // started_at is the server's transaction time, not anything the client sent.
    expect(Math.abs(row.server_now.getTime() - row.started_at!.getTime())).toBeLessThan(1000);
  });

  it("4. duplicate start requests never create a different deadline", async () => {
    const first = (await start()).rows[0];
    const results = await Promise.all([start(), start(), start()]);
    for (const r of results) {
      expect(r.rows[0].started_at!.getTime()).toBe(first.started_at!.getTime());
      expect(r.rows[0].ends_at!.getTime()).toBe(first.ends_at!.getTime());
    }
    const actions = (await audit()).map((a) => a.action);
    expect(actions.filter((a) => a === "MISSION_STARTED")).toHaveLength(1);
    expect(actions.filter((a) => a === "START_IGNORED")).toHaveLength(3);
  });

  it("2/13. re-reading state (refresh / reconnect) returns the same committed deadline", async () => {
    const started = (await start()).rows[0];
    await travel(db, eventId, 1800);
    const again = (await read()).rows[0];
    expect(again.state).toBe("RUNNING");
    expect(again.ends_at!.getTime()).toBe(started.ends_at!.getTime() - 1_800_000);
    const remaining = again.ends_at!.getTime() - again.server_now.getTime();
    expect(remaining).toBeGreaterThan(43_200_000 - 1_800_000 - 2000);
    expect(remaining).toBeLessThanOrEqual(43_200_000 - 1_800_000);
  });

  it("locks the official start time and duration after launch", async () => {
    await start();
    await expect(
      as(db, host, "select * from public.configure_mission($1, p_duration_seconds => 3600)", [eventId]),
    ).rejects.toThrow(/locked/i);
    // Even a superuser-level plain UPDATE is refused by the guard trigger.
    await expect(db.query("update public.event_timers set ends_at = ends_at + interval '1 hour'")).rejects.toThrow(
      /locked/i,
    );
  });

  it("allows duration to be configured before launch only", async () => {
    const r = await as<Clock>(db, host, "select * from public.configure_mission($1, p_duration_seconds => 7200)", [eventId]);
    expect(r.rows[0].duration_seconds).toBe(7200);
    const s = (await start()).rows[0];
    expect(s.ends_at!.getTime() - s.started_at!.getTime()).toBe(7_200_000);
  });
});

describe("completion", () => {
  it("5. the event completes server-side with no browser connected", async () => {
    await start();
    await travel(db, eventId, 43_200);
    const view = (await read()).rows[0];
    expect(view.state).toBe("COMPLETED");
    expect(view.completed_at!.getTime()).toBe(view.ends_at!.getTime());
    // cron-style sweep persists it
    await db.query("select public.finalize_overdue_missions()");
    const raw = (await db.query<{ state: string }>("select state from public.event_timers")).rows[0];
    expect(raw.state).toBe("COMPLETED");
  });

  it("9. completion persists and finalisation is idempotent", async () => {
    await start();
    await travel(db, eventId, 50_000);
    const a = (await as<Clock>(db, { role: "anon" }, "select * from public.finalize_mission($1)", [eventId])).rows[0];
    const b = (await as<Clock>(db, { role: "anon" }, "select * from public.finalize_mission($1)", [eventId])).rows[0];
    expect(a.state).toBe("COMPLETED");
    expect(b.completed_at!.getTime()).toBe(a.completed_at!.getTime());
    expect(b.version).toBe(a.version);
    expect((await audit()).filter((x) => x.action === "MISSION_COMPLETED")).toHaveLength(1);
    // A completed mission cannot be restarted.
    const again = (await start()).rows[0];
    expect(again.state).toBe("COMPLETED");
  });

  it("does not complete before the deadline", async () => {
    await start();
    await travel(db, eventId, 43_190);
    const r = (await as<Clock>(db, { role: "anon" }, "select * from public.finalize_mission($1)", [eventId])).rows[0];
    expect(r.state).toBe("RUNNING");
  });
});

describe("authorisation", () => {
  it("10. anonymous and non-staff users cannot start or modify the timer", async () => {
    await expect(as(db, { role: "anon" }, "select * from public.start_mission($1)", [eventId])).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      as(db, { role: "authenticated", sub: STRANGER }, "select * from public.start_mission($1)", [eventId]),
    ).rejects.toThrow(/not authorised/i);
    await expect(
      as(db, { role: "authenticated", sub: STRANGER }, "update public.event_timers set state = 'RUNNING'"),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      as(db, { role: "anon" }, "insert into public.timer_announcements (event_id, message) values ($1, 'x')", [eventId]),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      as(db, { role: "authenticated", sub: STRANGER }, "select * from public.publish_announcement($1, 'hi')", [eventId]),
    ).rejects.toThrow(/not authorised/i);
    expect((await read()).rows[0].state).toBe("NOT_STARTED");
  });

  it("does not expose the audit log to the public", async () => {
    await start();
    const anon = await as(db, { role: "anon" }, "select * from public.timer_audit_log").catch((e) => e);
    expect(anon instanceof Error ? anon.message : "").toMatch(/permission denied/i);
    const stranger = await as(db, { role: "authenticated", sub: STRANGER }, "select * from public.timer_audit_log");
    expect(stranger.rows).toHaveLength(0);
    const staff = await as(db, host, "select * from public.timer_audit_log");
    expect(staff.rows.length).toBeGreaterThan(0);
  });

  it("rate-limits administrative actions", async () => {
    let error: unknown;
    for (let i = 0; i < 40 && !error; i++) {
      error = await as(db, host, "select * from public.publish_announcement($1, $2)", [eventId, `Update ${i}`]).then(
        () => undefined,
        (e) => e,
      );
    }
    expect(String(error)).toMatch(/rate limit/i);
  });
});

describe("milestones & announcements", () => {
  it("locks milestone timing after launch but allows copy edits", async () => {
    const m = (await db.query<{ id: string }>("select id from public.timer_milestones where offset_seconds = 3600")).rows[0];
    await start();
    await expect(
      as(db, host, "select * from public.upsert_milestone($1, $2, 7200, 'DISCOVERY', 'x', null, null, null, true)", [eventId, m.id]),
    ).rejects.toThrow(/locked/i);
    const ok = await as<{ description: string; offset_seconds: number }>(
      db, host,
      "select * from public.upsert_milestone($1, $2, null, 'DISCOVERY', 'Mentors are on the floor', 'telescope', 'cyan', null, null)",
      [eventId, m.id],
    );
    expect(ok.rows[0].description).toBe("Mentors are on the floor");
    expect(ok.rows[0].offset_seconds).toBe(3600);
    await expect(as(db, host, "select public.delete_milestone($1, $2)", [eventId, m.id])).rejects.toThrow(/locked/i);
  });

  it("sanitises announcement text and stores priority/expiry", async () => {
    const r = await as<{ message: string; priority: string }>(
      db, host,
      "select * from public.publish_announcement($1, $2, 'high', 30, null, now() + interval '10 minutes')",
      [eventId, "  Mentor   review\u0007 begins\nin 15 minutes.  "],
    );
    expect(r.rows[0].message).toBe("Mentor review begins in 15 minutes.");
    expect(r.rows[0].priority).toBe("high");
    await expect(as(db, host, "select * from public.publish_announcement($1, '   ')", [eventId])).rejects.toThrow(/required/i);
  });
});

describe("emergency override", () => {
  const ops = (fresh = true) => ({ role: "authenticated" as const, sub: OVERRIDER, signedInSecondsAgo: fresh ? 30 : 3600 });
  const owner = { role: "authenticated" as const, sub: OWNER, signedInSecondsAgo: 30 };
  const reason = "Fire alarm evacuation of the main hall";

  it("14. is disabled by default and refused to hosts", async () => {
    await start();
    await expect(
      as(db, { ...host, signedInSecondsAgo: 10 }, "select * from public.emergency_override($1, 'HOLD', $2)", [eventId, reason]),
    ).rejects.toThrow(/not authorised/i);
    await expect(
      as(db, ops(), "select * from public.emergency_override($1, 'HOLD', $2)", [eventId, reason]),
    ).rejects.toThrow(/disabled/i);
  });

  it("14. requires owner arming, fresh re-authentication and a reason; always audits", async () => {
    await start();
    await expect(
      as(db, { ...owner, signedInSecondsAgo: 3600 }, "select * from public.set_override_enabled($1, true, $2)", [eventId, reason]),
    ).rejects.toThrow(/re-authentication/i);
    await as(db, owner, "select * from public.set_override_enabled($1, true, $2)", [eventId, reason]);

    await expect(
      as(db, ops(false), "select * from public.emergency_override($1, 'HOLD', $2)", [eventId, reason]),
    ).rejects.toThrow(/re-authentication/i);
    await expect(
      as(db, ops(), "select * from public.emergency_override($1, 'HOLD', 'because')", [eventId]),
    ).rejects.toThrow(/reason/i);

    const held = (await as<Clock>(db, ops(), "select * from public.emergency_override($1, 'HOLD', $2)", [eventId, reason])).rows[0];
    expect(held.state).toBe("EMERGENCY_OVERRIDE");
    expect(held.held_remaining_ms).toBeGreaterThan(43_190_000);

    const resumed = (await as<Clock>(db, ops(), "select * from public.emergency_override($1, 'RESUME', $2)", [eventId, reason])).rows[0];
    expect(resumed.state).toBe("RUNNING");

    const adjusted = (await as<Clock>(db, ops(), "select * from public.emergency_override($1, 'ADJUST', $2, 600)", [eventId, reason])).rows[0];
    expect(adjusted.ends_at!.getTime() - resumed.ends_at!.getTime()).toBe(600_000);

    const log = await audit();
    const overrides = log.filter((a) => a.action.startsWith("EMERGENCY_") || a.action.startsWith("OVERRIDE_"));
    expect(overrides.map((a) => a.action)).toEqual(["OVERRIDE_ARMED", "EMERGENCY_HOLD", "EMERGENCY_RESUME", "EMERGENCY_ADJUST"]);
    expect(overrides.every((a) => a.reason === reason)).toBe(true);

    // The audit trail is immutable.
    await expect(db.query("update public.timer_audit_log set reason = 'edited'")).rejects.toThrow(/append-only/i);
    await expect(db.query("delete from public.timer_audit_log")).rejects.toThrow(/append-only/i);
  });
});

describe("integration hooks", () => {
  it("enforces module deadlines server-side only when configured", async () => {
    await start();
    await as(db, host, "select public.set_module_integration($1, 'problem_statement_arena', true)", [eventId]);
    const open = async (k: string) =>
      (await as<{ open: boolean }>(db, { role: "anon" }, "select public.is_module_open($1, $2) as open", [eventId, k])).rows[0].open;
    expect(await open("problem_statement_arena")).toBe(true);
    await travel(db, eventId, 43_200);
    expect(await open("problem_statement_arena")).toBe(false);
    expect(await open("goodies_selection_arena")).toBe(true); // not configured: never auto-closed
  });
});
