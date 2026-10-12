export type RefreshHourType = "odd" | "even" | "every" | "unknown";

export type RefreshReportPatternRow = {
  hour_type: RefreshHourType;
  refresh_minute: number | null;
};

export type RefreshReferencePatternRow = {
  hour_type: Exclude<RefreshHourType, "unknown">;
  refresh_minute: number;
  source_name?: string;
  source_url?: string;
  confidence?: "community_reference" | "verified" | "estimated";
  has_external_conflict?: boolean;
};

export type ResolvedRefreshPattern = {
  hourType: Exclude<RefreshHourType, "unknown">;
  minute: number;
  source: "reports" | "reference";
  reportCount: number;
  matchingReportCount: number;
  reportConfidence: number | null;
  conflictsWithReference: boolean;
};

export function resolveRefreshPattern(
  reports: RefreshReportPatternRow[],
  reference?: RefreshReferencePatternRow | null
): ResolvedRefreshPattern | null {
  const valid = reports.filter(
    (row): row is RefreshReportPatternRow & {
      hour_type: Exclude<RefreshHourType, "unknown">;
      refresh_minute: number;
    } => row.hour_type !== "unknown" && row.refresh_minute !== null
  );

  const counts = new Map<
    string,
    {
      hourType: Exclude<RefreshHourType, "unknown">;
      minute: number;
      count: number;
    }
  >();

  for (const row of valid) {
    const key = `${row.hour_type}-${row.refresh_minute}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else {
      counts.set(key, {
        hourType: row.hour_type,
        minute: row.refresh_minute,
        count: 1,
      });
    }
  }

  const distribution = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.minute - b.minute;
  });

  const top = distribution[0] ?? null;
  const tied = Boolean(
    top && distribution.length > 1 && distribution[1]?.count === top.count
  );

  const winner = top && !tied ? top : null;

  if (winner) {
    const sameAsReference =
      reference &&
      reference.hour_type === winner.hourType &&
      reference.refresh_minute === winner.minute;

    // A single conflicting report should not immediately overwrite a seeded
    // reference. Two matching user reports are enough to supersede it.
    if (!reference || sameAsReference || winner.count >= 2) {
      return {
        hourType: winner.hourType,
        minute: winner.minute,
        source: "reports",
        reportCount: valid.length,
        matchingReportCount: winner.count,
        reportConfidence:
          valid.length > 0 ? Math.round((winner.count / valid.length) * 100) : null,
        conflictsWithReference: Boolean(reference && !sameAsReference),
      };
    }
  }

  if (reference?.has_external_conflict) {
    return null;
  }

  if (reference) {
    const matchingReportCount = valid.filter(
      (row) =>
        row.hour_type === reference.hour_type &&
        row.refresh_minute === reference.refresh_minute
    ).length;
    const conflicting = valid.some(
      (row) =>
        row.hour_type !== reference.hour_type ||
        row.refresh_minute !== reference.refresh_minute
    );

    return {
      hourType: reference.hour_type,
      minute: reference.refresh_minute,
      source: "reference",
      reportCount: valid.length,
      matchingReportCount,
      reportConfidence: null,
      conflictsWithReference: conflicting,
    };
  }

  return null;
}
