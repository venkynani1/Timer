import {
  Rocket, Telescope, Lightbulb, Hammer, Sparkles, Flame, Flag, Target, Zap, Orbit, Satellite, Cpu, Megaphone, Gift, Puzzle, Hourglass,
  type LucideIcon,
} from "lucide-react";

export const MILESTONE_ICONS: Record<string, LucideIcon> = {
  rocket: Rocket, telescope: Telescope, lightbulb: Lightbulb, hammer: Hammer, sparkles: Sparkles, flame: Flame, flag: Flag,
  target: Target, zap: Zap, orbit: Orbit, satellite: Satellite, cpu: Cpu, megaphone: Megaphone, gift: Gift, puzzle: Puzzle, hourglass: Hourglass,
};

export function MilestoneIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && MILESTONE_ICONS[name]) || Orbit;
  return <Icon className={className} aria-hidden="true" />;
}
