export const workloadPoints = { Light: 1, Standard: 2, Intensive: 4 } as const;
export type Workload = keyof typeof workloadPoints;
export const activityLabels = {
  green: "Lower activity",
  yellow: "Busy",
  red: "High activity",
  unknown: "Activity unconfirmed",
};
export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function calculateActivity(
  input: {
    rooms: number;
    doctors: number;
    support: number;
    workload: number;
    verified_at: string | null;
    updated_at?: string | null;
    closed_on?: string | null;
    override_tone?: string | null;
    override_reason?: string | null;
    override_until?: string | null;
  },
  now = Date.now(),
) {
  const resources = [
    { label: "Rooms", capacity: input.rooms * 2 },
    { label: "Doctors", capacity: input.doctors * 4 },
    { label: "Clinical support staff", capacity: input.support * 2 },
  ];
  const capacity = Math.min(...resources.map((r) => r.capacity));
  const fresh =
    !!input.verified_at &&
    now - new Date(input.verified_at).getTime() < 3600000 &&
    new Date(input.verified_at).getTime() <= now;
  const ratio = capacity > 0 ? input.workload / capacity : null;
  const computedTone =
    !fresh || ratio === null
      ? "unknown"
      : ratio < 0.6
        ? "green"
        : ratio < 0.85
          ? "yellow"
          : "red";
  const overrideActive =
    fresh &&
    capacity > 0 &&
    !!input.override_reason?.trim() &&
    !!input.override_until &&
    new Date(input.override_until).getTime() > now &&
    ["green", "yellow", "red"].includes(input.override_tone || "");
  const tone = (
    overrideActive ? input.override_tone : computedTone
  ) as keyof typeof activityLabels;
  const closed = input.closed_on === localDay(new Date(now));
  return {
    tone,
    label: activityLabels[tone],
    computedTone,
    capacity,
    ratio,
    percent: ratio === null ? null : Math.round(ratio * 100),
    workload: input.workload,
    resources,
    limiting: resources
      .filter((r) => r.capacity === capacity)
      .map((r) => r.label),
    fresh,
    overrideActive,
    overrideReason: overrideActive ? input.override_reason : null,
    overrideUntil: overrideActive ? input.override_until : null,
    acceptance: closed
      ? "Not accepting new patients today"
      : fresh
        ? "Inquiries open · call before travel"
        : "Acceptance unconfirmed · call first",
    accepting: !closed,
    updated_at: input.updated_at || input.verified_at,
    verified_at: input.verified_at,
  };
}
export function ownerActivity(activity: ReturnType<typeof calculateActivity>) {
  return {
    tone: activity.tone,
    label: activity.label,
    updated_at: activity.updated_at,
    acceptance: activity.acceptance,
    accepting: activity.accepting,
    fresh: activity.fresh,
    overridden: activity.overrideActive,
  };
}
