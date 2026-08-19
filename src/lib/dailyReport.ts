// Shapes for the structured JSONB body of a daily report, plus sanitizers used
// by the API when accepting client input. The header fields (date, status,
// reporter, GC, reviewer, job type) live in columns; everything below is the
// free-form-ish body a foreman fills out in the field.

export type WorkforceRow = {
  // teamMemberId is optional so a one-off name can be typed without adding the
  // person to the company crew list first.
  teamMemberId: string | null;
  name: string;
  activity: string;
  quantity: number; // number of people
  hours: number; // hours each
  areaId: string | null;
  notes: string; // per-crew notes (STACK workforce "Notes" column)
};

export type EquipmentRow = {
  name: string;
  quantity: number;
  hours: number;
};

export type EventEntry = {
  occurred: boolean;
  notes: string;
};

export type ReportEvents = {
  healthSafety: EventEntry;
  visitors: EventEntry;
  deliveries: EventEntry;
};

export type DailyReportBody = {
  workforce: WorkforceRow[];
  equipment: EquipmentRow[];
  events: ReportEvents;
  observations: string;
};

export const DEFAULT_ACTIVITY_TYPES = [
  "Framing",
  "Supervision",
  "Demo",
  "Concrete",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Drywall",
  "Painting",
  "Cleanup",
];

export function emptyEvents(): ReportEvents {
  return {
    healthSafety: { occurred: false, notes: "" },
    visitors: { occurred: false, notes: "" },
    deliveries: { occurred: false, notes: "" },
  };
}

export function emptyReportBody(): DailyReportBody {
  return {
    workforce: [],
    equipment: [],
    events: emptyEvents(),
    observations: "",
  };
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function sanitizeEvent(v: unknown): EventEntry {
  const e = (v ?? {}) as Record<string, unknown>;
  return { occurred: Boolean(e.occurred), notes: str(e.notes) };
}

// Coerce arbitrary client input into a well-formed body, dropping anything
// unexpected. Mirrors the defensive sanitizeReport() used for walkthroughs.
export function sanitizeReportBody(input: unknown): DailyReportBody {
  const b = (input ?? {}) as Record<string, unknown>;

  const workforce = Array.isArray(b.workforce)
    ? b.workforce.map((r): WorkforceRow => {
        const row = (r ?? {}) as Record<string, unknown>;
        return {
          teamMemberId: strOrNull(row.teamMemberId),
          name: str(row.name),
          activity: str(row.activity),
          quantity: toNumber(row.quantity),
          hours: toNumber(row.hours),
          areaId: strOrNull(row.areaId),
          notes: str(row.notes),
        };
      })
    : [];

  const equipment = Array.isArray(b.equipment)
    ? b.equipment.map((r): EquipmentRow => {
        const row = (r ?? {}) as Record<string, unknown>;
        return {
          name: str(row.name),
          quantity: toNumber(row.quantity),
          hours: toNumber(row.hours),
        };
      })
    : [];

  const ev = (b.events ?? {}) as Record<string, unknown>;
  const events: ReportEvents = {
    healthSafety: sanitizeEvent(ev.healthSafety),
    visitors: sanitizeEvent(ev.visitors),
    deliveries: sanitizeEvent(ev.deliveries),
  };

  return {
    workforce,
    equipment,
    events,
    observations: str(b.observations),
  };
}

// Read a possibly-legacy/partial stored body into the current shape.
export function readReportBody(input: unknown): DailyReportBody {
  if (!input) return emptyReportBody();
  return sanitizeReportBody(input);
}

export function rowTotalHours(row: {
  quantity: number;
  hours: number;
}): number {
  return row.quantity * row.hours;
}

export function totalWorkforceHours(body: DailyReportBody): number {
  return body.workforce.reduce((sum, r) => sum + rowTotalHours(r), 0);
}

export function totalEquipmentHours(body: DailyReportBody): number {
  return body.equipment.reduce((sum, r) => sum + rowTotalHours(r), 0);
}
