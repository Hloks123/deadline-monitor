export type RecurrenceFrequency =
  | "once"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "month_end"
  | "quarterly"
  | "annually"
  | "custom";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "archived";

export type OccurrenceStatus =
  | "upcoming"
  | "due_today"
  | "in_progress"
  | "completed"
  | "skipped"
  | "failed"
  | "overdue"
  | "cancelled";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;

  // weekly / weekdays
  weekdays?: number[]; // 0 = Sunday ... 6 = Saturday

  // monthly
  dayOfMonth?: number;

  // custom
  interval?: number;
  intervalUnit?: "day" | "week" | "month" | "year";
}

export interface RecurringTask {
  id: string;

  organisationId: string;

  name: string;
  description?: string;

  linkedRecordId?: string;
  linkedFolderId?: string;

  ownerId: string;
  reviewerId?: string;

  priority: TaskPriority;

  startDate: string;
  dueTime?: string;
  timezone: string;

  recurrence: RecurrenceRule;

  escalationRule?: {
    enabled: boolean;
    afterDays: number;
    escalateToUserId?: string;
  };

  requiresCompletionEvidence: boolean;
  requiresConsultantReview: boolean;
  clientVisible?: boolean;
  clientCanSkip?: boolean;

  status: TaskStatus;

  lastRunAt?: string;
  nextRunAt?: string;

  createdAt: string;
  updatedAt: string;
}

export type RecurringTaskInput = Omit<
  RecurringTask,
  "id" | "createdAt" | "updatedAt"
>;

export interface TaskOccurrence {

  id: string;

  recurringTaskId: string;
  recurringTaskName?: string;
  organisationId: string;

  scheduledFor: string;
  dueAt: string;

  status: OccurrenceStatus;

  ownerId: string;

  uniqueKey: string;

  startedAt?: string;
  completedAt?: string;

  completionEvidence?: string;

  skippedReason?: string;
  failureReason?: string;

  retryCount: number;

  createdAt: string;
  updatedAt: string;
}