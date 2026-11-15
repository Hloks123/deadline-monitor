import {
  filterClientActivities,
  type ClientActivity,
  type ClientActivityFilters,
} from "@/lib/clientActivities";

import {
  loadConsultantWorkSnapshot,
  type ConsultantWorkSnapshot,
} from "@/lib/consultantWork";

import {
  businessDateKey,
  clientBusinessToday,
} from "@/lib/clientWorkspaceSelectors";

import {
  getRecords,
  type MonitoredRecord,
} from "@/lib/recordStore";

export type ConsultantActivity =
  ClientActivity & {
    organisationName: string;
  };

export type ConsultantActivityFilters =
  ClientActivityFilters & {
    organisationId?: string;
    priority?: "all" | "high" | "medium" | "low";
  };

function normalisePriority(
  value?: string
): ClientActivity["priority"] {
  const normalised =
    value?.trim().toLowerCase();

  if (
    normalised === "critical" ||
    normalised === "high"
  ) {
    return "high";
  }

  if (normalised === "medium") {
    return "medium";
  }

  if (normalised === "low") {
    return "low";
  }

  return undefined;
}

function normaliseStatus(
  value: string
): ClientActivity["status"] {
  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalised === "expired") {
    return "expired";
  }

  if (
    normalised === "overdue" ||
    normalised === "failed"
  ) {
    return "overdue";
  }

  if (
    normalised === "completed" ||
    normalised === "complete"
  ) {
    return "completed";
  }

  if (normalised === "blocked") {
    return "blocked";
  }

  if (
    normalised === "awaiting_confirmation" ||
    normalised === "awaiting_client"
  ) {
    return "awaiting_confirmation";
  }

  if (normalised === "in_progress") {
    return "in_progress";
  }

  if (normalised === "due_today") {
    return "due_today";
  }

  if (normalised === "paused") {
    return "paused";
  }

  if (
    normalised === "cancelled" ||
    normalised === "canceled"
  ) {
    return "cancelled";
  }

  if (normalised === "skipped") {
    return "skipped";
  }

  if (
    normalised === "not_started" ||
    normalised === "scheduled"
  ) {
    return "not_started";
  }

  if (
    normalised === "upcoming" ||
    normalised === "current"
  ) {
    return "upcoming";
  }

  return "unknown";
}

function recordStatus(
  record: MonitoredRecord,
  date: string,
  today: string,
  expiry: boolean
): ClientActivity["status"] {
  if (
    record.status ===
      "Awaiting confirmation" ||
    record.status === "Awaiting client"
  ) {
    return "awaiting_confirmation";
  }

  if (record.status === "Paused") {
    return "paused";
  }

  if (record.status === "Completed") {
    return "completed";
  }

  if (date < today) {
    return expiry
      ? "expired"
      : "overdue";
  }

  if (date === today) {
    return "due_today";
  }

  return "upcoming";
}

function consultantRecordRoute(
  recordId: string
) {
  return `/monitored-records/${recordId}`;
}

function consultantWorkRoute(
  item: ConsultantWorkSnapshot["tasks"][number]
) {
  if (
    item.kind === "recurring" &&
    item.occurrence?.recurringTaskId
  ) {
    return `/recurring-tasks/${item.occurrence.recurringTaskId}`;
  }

  return "/work";
}

function buildRecordActivities(
  records: MonitoredRecord[],
  organisationNames: Map<
    string,
    string
  >,
  activeOrganisationIds: Set<string>,
  today: string
): ConsultantActivity[] {
  const activities:
    ConsultantActivity[] = [];

  for (const record of records) {
    if (
      !activeOrganisationIds.has(
        record.organisationId
      )
    ) {
      continue;
    }

    const organisationName =
      organisationNames.get(
        record.organisationId
      ) ||
      record.organisation ||
      record.organisationId;

    const expiryDate =
      businessDateKey(
        record.expiryDate
      );

    if (expiryDate) {
      activities.push({
        id: `consultant-record-expiry:${record.organisationId}:${record.id}`,
        organisationId:
          record.organisationId,
        organisationName,
        title: `Expiry: ${record.name}`,
        description: organisationName,
        activityType:
          "record_expiry",
        sourceEntityType: "record",
        sourceEntityId: record.id,
        relatedName: record.name,
        date: expiryDate,
        responsiblePerson:
          record.contact || undefined,
        priority: normalisePriority(
          record.risk
        ),
        status: recordStatus(
          record,
          expiryDate,
          today,
          true
        ),
        nextAction:
          record.nextAction ||
          "Review record expiry",
        route:
          consultantRecordRoute(
            record.id
          ),
      });
    }

    const followUpDate =
      businessDateKey(
        record.followUp
      );

    if (followUpDate) {
      activities.push({
        id: `consultant-record-follow-up:${record.organisationId}:${record.id}`,
        organisationId:
          record.organisationId,
        organisationName,
        title:
          record.nextAction ||
          `Follow up: ${record.name}`,
        description: organisationName,
        activityType:
          "record_follow_up",
        sourceEntityType: "record",
        sourceEntityId: record.id,
        relatedName: record.name,
        date: followUpDate,
        responsiblePerson:
          record.contact || undefined,
        priority: normalisePriority(
          record.risk
        ),
        status: recordStatus(
          record,
          followUpDate,
          today,
          false
        ),
        nextAction:
          record.nextAction ||
          "Review record follow-up",
        route:
          consultantRecordRoute(
            record.id
          ),
      });
    }
  }

  return activities;
}

function buildWorkActivities(
  snapshot: ConsultantWorkSnapshot
): ConsultantActivity[] {
  return snapshot.tasks
    .filter((item) =>
      item.kind !== "record" &&
      Boolean(item.dueDate)
    )
    .map((item) => ({
      id: `consultant-work:${item.organisationId}:${item.id}`,
      organisationId:
        item.organisationId,
      organisationName:
        item.organisation,
      title: item.task,
      description: `${item.organisation} · ${item.source}`,
      activityType:
        item.kind === "checklist"
          ? "checklist_item" as const
          : "recurring_task" as const,
      sourceEntityType:
        item.kind === "checklist"
          ? "checklist" as const
          : "task" as const,
      sourceEntityId:
        item.occurrence?.recurringTaskId ||
        item.id,
      relatedName:
        item.related !== "—"
          ? item.related
          : undefined,
      date: item.dueDate,
      time:
        item.dueTime || undefined,
      responsiblePerson:
        item.responsible !==
        "Unassigned"
          ? item.responsible
          : undefined,
      priority:
        normalisePriority(
          item.priority
        ),
      status:
        normaliseStatus(
          item.status
        ),
      nextAction:
        item.nextAction ||
        item.status,
      route:
        consultantWorkRoute(
          item
        ),
    }));
}

export function getConsultantActivities(
  snapshot =
    loadConsultantWorkSnapshot(),
  today = clientBusinessToday()
): ConsultantActivity[] {
  const organisationNames =
    new Map(
      snapshot.organisations.map(
        (organisation) => [
          organisation.id,
          organisation.name,
        ]
      )
    );

  const activeOrganisationIds =
    new Set(
      snapshot.organisations.map(
        (organisation) =>
          organisation.id
      )
    );

  const records =
    Object.values(getRecords());

  const activities = [
    ...buildRecordActivities(
      records,
      organisationNames,
      activeOrganisationIds,
      today
    ),
    ...buildWorkActivities(snapshot),
  ];

  return activities
    .filter((activity) =>
      Boolean(
        businessDateKey(
          activity.date
        )
      )
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(
          right.date
        ) ||
        (left.time || "").localeCompare(
          right.time || ""
        ) ||
        left.organisationName.localeCompare(
          right.organisationName
        ) ||
        left.title.localeCompare(
          right.title
        )
    );
}

export function filterConsultantActivities(
  activities:
    ConsultantActivity[],
  filters:
    ConsultantActivityFilters
): ConsultantActivity[] {
  const organisationId =
    filters.organisationId ||
    "all";

  const priority =
    filters.priority || "all";

  const activitiesById = new Map(
    activities.map((activity) => [
      activity.id,
      activity,
    ])
  );

  return filterClientActivities(
    activities,
    filters
  ).flatMap((activity) => {
    const consultantActivity =
      activitiesById.get(activity.id);
    if (!consultantActivity) {
      return [];
    }

    const organisationMatches =
      organisationId === "all" ||
      consultantActivity.organisationId ===
        organisationId;

    const priorityMatches =
      priority === "all" ||
      consultantActivity.priority === priority;

    return organisationMatches &&
      priorityMatches
      ? [consultantActivity]
      : [];
  });
}
