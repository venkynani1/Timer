import type { Announcement, DisplayMode, EventIdentity, Milestone, MissionClock, TimerState } from "./types";

const ts = (v: unknown): number | null => (v === null || v === undefined ? null : new Date(v as string).getTime());

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapClock(r: any): MissionClock {
  return {
    eventId: r.event_id,
    state: r.state as TimerState,
    durationSeconds: Number(r.duration_seconds),
    startedAt: ts(r.started_at),
    endsAt: ts(r.ends_at),
    completedAt: ts(r.completed_at),
    heldAt: ts(r.held_at),
    heldRemainingMs: r.held_remaining_ms === null || r.held_remaining_ms === undefined ? null : Number(r.held_remaining_ms),
    overrideEnabled: Boolean(r.override_enabled),
    displayMode: (r.display_mode ?? "cinematic") as DisplayMode,
    soundEnabled: Boolean(r.sound_enabled),
    closingMessage: r.closing_message ?? "",
    version: Number(r.version),
    updatedAt: ts(r.updated_at) ?? 0,
  };
}

export function mapMilestone(r: any): Milestone {
  return {
    id: r.id,
    offsetSeconds: Number(r.offset_seconds),
    title: r.title,
    description: r.description ?? "",
    icon: r.icon ?? null,
    theme: r.theme ?? null,
    announcement: r.announcement ?? null,
    enabled: Boolean(r.enabled),
  };
}

export function mapAnnouncement(r: any): Announcement {
  return {
    id: r.id,
    message: r.message,
    priority: r.priority,
    displaySeconds: Number(r.display_seconds),
    publishAt: ts(r.publish_at) ?? 0,
    expiresAt: ts(r.expires_at),
    cancelledAt: ts(r.cancelled_at),
    createdAt: ts(r.created_at) ?? 0,
  };
}

export function mapEvent(r: any): EventIdentity {
  return { id: r.id, slug: r.slug, name: r.name, subtitle: r.subtitle, tagline: r.tagline };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
