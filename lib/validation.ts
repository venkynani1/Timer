import { z } from "zod";

// Strip control chars, collapse whitespace. React escapes on render; the DB sanitises again.
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

export const slugSchema = z.string().regex(/^[a-z0-9-]{2,64}$/);

export const startSchema = z.object({ event: slugSchema, confirm: z.literal("LAUNCH") });

export const configureSchema = z.object({
  event: slugSchema,
  name: cleanText(80).pipe(z.string().min(1)).optional(),
  subtitle: cleanText(60).pipe(z.string().min(1)).optional(),
  tagline: cleanText(140).pipe(z.string().min(1)).optional(),
  durationSeconds: z.number().int().min(60).max(172_800).optional(),
  closingMessage: cleanText(200).pipe(z.string().min(1)).optional(),
  soundEnabled: z.boolean().optional(),
  displayMode: z.enum(["cinematic", "minimal", "command"]).optional(),
});

export const milestoneSchema = z.object({
  event: slugSchema,
  id: z.string().uuid().nullable(),
  offsetSeconds: z.number().int().min(0).max(172_800).nullable(),
  title: cleanText(60).pipe(z.string().min(1)),
  description: cleanText(280),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/).nullable(),
  theme: z.enum(["cyan", "blue", "violet", "amber", "orange", "red", "green"]).nullable(),
  announcement: cleanText(280).nullable(),
  enabled: z.boolean().nullable(),
});

export const deleteSchema = z.object({ event: slugSchema, id: z.string().uuid() });

export const announcementSchema = z
  .object({
    event: slugSchema,
    message: cleanText(280).pipe(z.string().min(1, "Message is required")),
    priority: z.enum(["info", "normal", "high", "critical"]).default("normal"),
    displaySeconds: z.number().int().min(5).max(3600).default(20),
    publishAt: z.string().datetime({ offset: true }).nullable().default(null),
    expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .refine((v) => !v.expiresAt || !v.publishAt || new Date(v.expiresAt) > new Date(v.publishAt), {
    message: "Expiry must be after publication",
    path: ["expiresAt"],
  });

export const overrideSchema = z.object({
  event: slugSchema,
  action: z.enum(["HOLD", "RESUME", "ADJUST"]),
  deltaSeconds: z.number().int().min(-3600).max(7200).nullable().default(null),
  reason: cleanText(500).pipe(z.string().min(10, "Give a reason of at least 10 characters")),
  password: z.string().min(1).max(256),
});

export const armSchema = z.object({
  event: slugSchema,
  enabled: z.boolean(),
  reason: cleanText(500).pipe(z.string().min(10, "Give a reason of at least 10 characters")),
  password: z.string().min(1).max(256),
});

export const integrationSchema = z.object({
  event: slugSchema,
  moduleKey: z.string().regex(/^[a-z0-9_]{2,60}$/),
  closeOnDeadline: z.boolean(),
});

export const resetSchema = z.object({
  event: slugSchema,
  confirm: z.literal("RESET"),
  reason: cleanText(500).pipe(z.string().min(10, "Give a reason of at least 10 characters")),
  password: z.string().min(1).max(256),
});
