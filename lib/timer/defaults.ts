import type { Milestone } from "./types";

export const DEFAULT_DURATION_SECONDS = 43_200;
export const DEFAULT_CLOSING_MESSAGE = "12 HOURS. COUNTLESS IDEAS. ONE INCREDIBLE MISSION.";

export const DEFAULT_MILESTONES: Milestone[] = [
  { id: "m-ignition", offsetSeconds: 0, title: "IGNITION", description: "The mission clock is live. Form up, align, and lock your mission objective.", icon: "rocket", theme: "cyan", announcement: "Mission is live. Twelve hours start now.", enabled: true },
  { id: "m-discovery", offsetSeconds: 3600, title: "DISCOVERY", description: "Research the problem space. Talk to mentors. Map the users.", icon: "telescope", theme: "cyan", announcement: "Discovery phase has begun.", enabled: true },
  { id: "m-ideation", offsetSeconds: 10800, title: "IDEATION", description: "Diverge, then converge. Choose the idea worth building.", icon: "lightbulb", theme: "blue", announcement: "Ideation phase has begun.", enabled: true },
  { id: "m-build", offsetSeconds: 18000, title: "BUILD MODE", description: "Design systems, prototypes, flows. Make it real.", icon: "hammer", theme: "violet", announcement: "Build mode engaged.", enabled: true },
  { id: "m-refine", offsetSeconds: 32400, title: "REFINEMENT", description: "Polish, test with real people, tighten the story.", icon: "sparkles", theme: "amber", announcement: "Refinement phase has begun.", enabled: true },
  { id: "m-final", offsetSeconds: 39600, title: "FINAL PUSH", description: "One hour left. Finish, rehearse, and prepare your submission.", icon: "flame", theme: "orange", announcement: "The final hour has begun.", enabled: true },
  { id: "m-complete", offsetSeconds: 43200, title: "MISSION COMPLETE", description: "Pencils down. Submissions are closed.", icon: "flag", theme: "green", announcement: null, enabled: true },
];
