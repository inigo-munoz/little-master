import { clsx } from "clsx";

const SOURCE_LABELS: Record<string, string> = {
  official: "Official",
  srd: "SRD",
  campaign: "Campaign",
  homebrew_external: "Homebrew",
  homebrew_user: "Homebrew (User)",
  ai_inferred: "AI Inferred",
};

const SOURCE_CLASSES: Record<string, string> = {
  official: "badge-official",
  srd: "badge-srd",
  campaign: "badge-campaign",
  homebrew_external: "badge-homebrew",
  homebrew_user: "badge-homebrew",
  ai_inferred: "badge-ai",
};

const AUTHORITY_CLASSES: Record<string, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SourceBadge({ sourceType }: { sourceType: string }) {
  return (
    <Badge className={SOURCE_CLASSES[sourceType] ?? "badge-low"}>
      {SOURCE_LABELS[sourceType] ?? sourceType}
    </Badge>
  );
}

export function AuthorityBadge({ level }: { level: string }) {
  return (
    <Badge className={AUTHORITY_CLASSES[level] ?? "badge-low"}>
      {level}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    critical: "bg-red-900 text-red-300 border border-red-700",
    major: "bg-orange-900 text-orange-300 border border-orange-700",
    minor: "bg-yellow-900 text-yellow-300 border border-yellow-700",
    info: "bg-stone-800 text-stone-400 border border-stone-600",
  };
  return (
    <Badge className={classes[severity] ?? classes["info"]!}>
      {severity}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    active: "bg-emerald-900 text-emerald-300 border border-emerald-700",
    paused: "bg-amber-900 text-amber-300 border border-amber-700",
    completed: "bg-blue-900 text-blue-300 border border-blue-700",
    archived: "bg-stone-800 text-stone-500 border border-stone-600",
    open: "bg-red-900 text-red-300 border border-red-700",
    resolved: "bg-emerald-900 text-emerald-300 border border-emerald-700",
    dismissed: "bg-stone-800 text-stone-500 border border-stone-600",
    alive: "bg-emerald-900 text-emerald-300 border border-emerald-700",
    dead: "bg-red-900 text-red-300 border border-red-700",
    unknown: "bg-stone-800 text-stone-400 border border-stone-600",
    missing: "bg-amber-900 text-amber-300 border border-amber-700",
  };
  return (
    <Badge className={classes[status] ?? "badge-low"}>
      {status}
    </Badge>
  );
}
