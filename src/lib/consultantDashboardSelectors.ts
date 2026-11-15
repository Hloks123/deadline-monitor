import type {
  ConsultantException,
  ConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import type { AuditEvent } from "@/lib/recordStore";

export type ConsultantDashboardSummary = {
  exceptions: {
    critical: number;
    high: number;
    blocked: number;
    failedRecurring: number;
    awaitingConfirmation: number;
    highRiskExpiredRecords: number;
    missedRecurring: number;
    pausedSchedulesRequiringReview: number;
    ordered: ConsultantException[];
  };
  today: {
    total: number;
    tasks: number;
    checklist: number;
    recurringOccurrences: number;
    recordActions: number;
  };
  workRequiringAttention: number;
  recurring: {
    active: number;
    paused: number;
    healthy: number;
    missed: number;
    failed: number;
  };
};

const closedStatuses = new Set([
  "completed",
  "skipped",
  "cancelled",
  "canceled",
]);

const severityOrder: Record<
  ConsultantException["severity"],
  number
> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const materialAuditActions: Array<{
  entityType: string;
  action: RegExp;
}> = [
  {
    entityType: "record",
    action: /^(Client monitored record created|Client monitored record edited|Client replacement date confirmed|Expiry date changed|Responsible contact changed|Follow-up created from Calendar)$/i,
  },
  {
    entityType: "recurring task",
    action: /^(Task created from Calendar|Recurring task (created|edited|completed|paused|resumed|schedule changed|owner changed))$/i,
  },
  {
    entityType: "checklist item",
    action: /^(Checklist item added|Task completed|Due date changed|Responsible person changed)$/i,
  },
];

function auditEventTime(event: AuditEvent) {
  const parsed = Date.parse(event.timestamp || event.date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getRecentConsultantDashboardActivity(
  events: AuditEvent[],
  organisations: Array<{ id: string; name: string }>,
  limit = 6,
): AuditEvent[] {
  const activeOrganisationIds = new Set(
    organisations.map((organisation) => organisation.id),
  );
  const activeOrganisationNames = new Set(
    organisations.map((organisation) =>
      organisation.name.trim().toLocaleLowerCase(),
    ),
  );

  return events
    .filter((event) => {
      const eventType = (event.entityType || "").trim().toLocaleLowerCase();
      const isMaterial = materialAuditActions.some((candidate) =>
        candidate.entityType === eventType &&
        candidate.action.test(event.action.trim()),
      );
      if (!isMaterial ||
        !activeOrganisationNames.has(event.organisation.trim().toLocaleLowerCase())) {
        return false;
      }

      const organisationId = (event.context || "").match(/Organisation ID:\s*([^;,]+)/i)?.[1]?.trim();
      return !organisationId || activeOrganisationIds.has(organisationId);
    })
    .sort((left, right) => auditEventTime(right) - auditEventTime(left))
    .slice(0, Math.max(0, limit));
}

export function getConsultantDashboardSummary(
  snapshot: ConsultantWorkSnapshot,
  today: string,
): ConsultantDashboardSummary {
  const exceptions = snapshot.exceptions;
  const completedWorkKeys = new Set(
    snapshot.completed.map((item) => `${item.organisationId}:${item.id}`),
  );
  const todayWork = snapshot.tasks.filter((item) =>
    item.dueDate === today &&
    !closedStatuses.has(item.status.toLowerCase()) &&
    !completedWorkKeys.has(`${item.organisationId}:${item.id}`),
  );
  const recurrenceByTask = new Map(
    snapshot.recurring.map((schedule) => [
      `${schedule.task.organisationId}:${schedule.task.id}`,
      schedule.task.recurrence.frequency,
    ]),
  );
  const todayRecurringWork = todayWork.filter((item) =>
    item.kind === "recurring",
  );
  const attentionWork = snapshot.tasks.filter((item) => {
    const status = item.status.toLowerCase();
    return item.kind !== "record" &&
      !closedStatuses.has(status) &&
      (Boolean(item.dueDate && item.dueDate <= today) ||
        status === "overdue" ||
        status === "failed");
  });
  const recurring = snapshot.recurring;

  return {
    exceptions: {
      critical: exceptions.filter((item) =>
        item.severity === "Critical",
      ).length,
      high: exceptions.filter((item) =>
        item.severity === "High",
      ).length,
      blocked: exceptions.filter((item) =>
        item.issue === "Checklist item is blocked",
      ).length,
      failedRecurring: exceptions.filter((item) =>
        item.issue === "Recurring occurrence failed",
      ).length,
      awaitingConfirmation: exceptions.filter((item) =>
        item.issue.toLowerCase().includes("awaiting client confirmation"),
      ).length,
      highRiskExpiredRecords: exceptions.filter((item) =>
        item.issue === "High-risk record has expired",
      ).length,
      missedRecurring: exceptions.filter((item) =>
        item.issue === "Missed recurring occurrence",
      ).length,
      pausedSchedulesRequiringReview: recurring.filter((item) =>
        item.task.status === "paused" &&
        item.jobHealth === "Paused schedule requires review",
      ).length,
      ordered: [...exceptions].sort((left, right) =>
        severityOrder[left.severity] - severityOrder[right.severity] ||
        (left.date || "9999-12-31").localeCompare(right.date || "9999-12-31"),
      ),
    },
    today: {
      total: todayWork.length,
      tasks: todayRecurringWork.filter((item) =>
        recurrenceByTask.get(
          `${item.organisationId}:${item.occurrence?.recurringTaskId}`,
        ) === "once",
      ).length,
      checklist: todayWork.filter((item) =>
        item.kind === "checklist",
      ).length,
      recurringOccurrences: todayRecurringWork.filter((item) =>
        recurrenceByTask.get(
          `${item.organisationId}:${item.occurrence?.recurringTaskId}`,
        ) !== "once",
      ).length,
      recordActions: todayWork.filter((item) =>
        item.kind === "record",
      ).length,
    },
    workRequiringAttention: attentionWork.length,
    recurring: {
      active: recurring.filter((item) =>
        item.task.status === "active",
      ).length,
      paused: recurring.filter((item) =>
        item.task.status === "paused",
      ).length,
      healthy: recurring.filter((item) =>
        item.jobHealth === "Healthy",
      ).length,
      missed: recurring.filter((item) =>
        item.jobHealth === "Missed occurrence",
      ).length,
      failed: recurring.filter((item) =>
        item.jobHealth.startsWith("Failed"),
      ).length,
    },
  };
}
