export type RefreshConflictHourType = "odd" | "even" | "every";

export type RefreshConflictObservation = {
  observation_kind: "exact" | "range";
  start_hour_type: RefreshConflictHourType;
  start_minute: number;
  end_hour_type: RefreshConflictHourType;
  end_minute: number;
};

function cyclePoint(hourType: RefreshConflictHourType, minute: number) {
  if (hourType === "every") return null;
  return (hourType === "odd" ? 60 : 0) + minute;
}

export function observationConflictsWithPattern(
  observation: RefreshConflictObservation,
  hourType: RefreshConflictHourType,
  minute: number
) {
  if (observation.observation_kind === "exact") {
    if (observation.start_hour_type === "every") {
      return observation.start_minute !== minute;
    }

    if (hourType === "every") {
      return (
        observation.start_hour_type !== "every" ||
        observation.start_minute !== minute
      );
    }

    return (
      observation.start_hour_type !== hourType ||
      observation.start_minute !== minute
    );
  }

  if (
    hourType === "every" ||
    observation.start_hour_type === "every" ||
    observation.end_hour_type === "every"
  ) {
    return false;
  }

  const candidate = cyclePoint(hourType, minute);
  const start = cyclePoint(
    observation.start_hour_type,
    observation.start_minute
  );
  const end = cyclePoint(
    observation.end_hour_type,
    observation.end_minute
  );

  if (candidate === null || start === null || end === null) {
    return false;
  }

  const inside =
    start <= end
      ? candidate >= start && candidate <= end
      : candidate >= start || candidate <= end;

  return !inside;
}
