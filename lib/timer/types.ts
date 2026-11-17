export type TimerState = "NOT_STARTED" | "RUNNING" | "COMPLETED" | "EMERGENCY_OVERRIDE";
export type DisplayMode = "cinematic" | "minimal" | "command";
export type AnnouncementPriority = "info" | "normal" | "high" | "critical";
export type MilestoneTheme = "cyan" | "blue" | "violet" | "amber" | "orange" | "red" | "green";

/** Authoritative clock row as served by the `mission_clock` view. Times are epoch ms. */
export interface MissionClock {
  eventId: string;
  state: TimerState;
  durationSeconds: number;
  startedAt: number | null;
  endsAt: number | null;
  completedAt: number | null;
  heldAt: number | null;
  heldRemainingMs: number | null;
  overrideEnabled: boolean;
  displayMode: DisplayMode;
  soundEnabled: boolean;
  closingMessage: string;
  version: number;
  updatedAt: number;
}

export interface EventIdentity {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  tagline: string;
}

export interface Milestone {
  id: string;
  offsetSeconds: number;
  title: string;
  description: string;
  icon: string | null;
  theme: MilestoneTheme | null;
  announcement: string | null;
  enabled: boolean;
}

export interface Announcement {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  displaySeconds: number;
  publishAt: number;
  expiresAt: number | null;
  cancelledAt: number | null;
  createdAt: number;
}

export interface MissionBundle {
  event: EventIdentity;
  clock: MissionClock;
  milestones: Milestone[];
  announcements: Announcement[];
  /** Server time (ms) at which the bundle was produced. */
  serverNow: number;
}
