import { getClient } from "@/lib/clientStore";
import { addAuditEvent } from "@/lib/recordStore";
import {
  CLIENT_WORKSPACE_ORGANISATION_ID,
  CLIENT_WORKSPACE_USER,
  getClientProfileStorageKey,
} from "@/lib/clientWorkspaceConstants";

export type ReminderDelivery = "In-app only" | "Email and in-app" | "No reminder";
export type SummaryFrequency = "Daily" | "Weekly on Monday" | "Weekly on selected weekday" | "Monthly" | "Custom";
export type ReminderCategory =
  | "work-today"
  | "work-week"
  | "work-month"
  | "overdue"
  | "blocked"
  | "records-expiring"
  | "incomplete-monthly";

export interface ReminderPreference {
  delivery: ReminderDelivery;
  summaryFrequency: SummaryFrequency;
  weekday?: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  time: string;
  dailySummary: "selected-time" | "morning" | "end-of-day";
  monthlyRule: "first-working-day" | "last-working-day" | "selected-day";
  monthlyDay?: number;
  categories: ReminderCategory[];
  timeZone: string;
  customFrequency?: "day" | "week" | "month";
  customInterval?: number;
  customWeekdays?: number[];
  startDate?: string;
  endDate?: string;
}

export interface ResponsiblePerson {
  id: string;
  organisationId: string;
  name: string;
  email?: string;
  role?: string;
  active: boolean;
}

export type TrackerPeriod = "Daily checklist" | "Weekly tracker" | "Monthly tracker" | "Custom tracker";
export type TrackerStatus = "Draft" | "Active" | "Completed" | "Archived";
export type ChecklistStatus =
  | "Not Started"
  | "In Progress"
  | "Scheduled"
  | "Awaiting Confirmation"
  | "Completed"
  | "Skipped"
  | "Blocked"
  | "Overdue"
  | "Carry Forward";
export type WorkPriority = "High" | "Medium" | "Low";

export interface WorkTracker {
  id: string;
  organisationId: string;
  name: string;
  description?: string;
  periodType: TrackerPeriod;
  startDate: string;
  endDate: string;
  ownerId: string;
  reminderPreference: ReminderDelivery;
  status: TrackerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  organisationId: string;
  trackerId: string;
  task: string;
  responsiblePersonId: string;
  responsiblePersonName: string;
  responsibleEmail?: string;
  targetDate: string;
  targetTime?: string;
  status: ChecklistStatus;
  clientCanSkip?: boolean;
  priority: WorkPriority;
  progressNotes?: string;
  nextAction?: string;
  completionEvidence?: string;
  reminderPreference: ReminderDelivery;
  completedDate?: string;
  blockedReason?: string;
  carryForwardReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWorkspaceState {
  organisationId: string;
  people: ResponsiblePerson[];
  trackers: WorkTracker[];
  items: ChecklistItem[];
  reminderPreference: ReminderPreference;
}

const STORAGE_KEY = "docmon_client_workspace_v1";
const reminders: ReminderPreference = {
  delivery: "In-app only",
  summaryFrequency: "Weekly on Monday",
  weekday: "Monday",
  time: "09:00",
  dailySummary: "morning",
  monthlyRule: "last-working-day",
  categories: ["overdue", "work-week", "blocked", "records-expiring"],
  timeZone: "Africa/Johannesburg",
};

function getDefaultPeople(): ResponsiblePerson[] {
  if (!CLIENT_WORKSPACE_ORGANISATION_ID) return [];
  const client = getClient(CLIENT_WORKSPACE_ORGANISATION_ID);
  return (client?.contacts || []).filter((person) => person.authorised).map((person) => ({
    id: person.id,
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    name: person.name,
    email: person.email || undefined,
    role: person.role || undefined,
    active: true,
  }));
}

function dispatchUpdate() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("deadline-monitor-updated"));
}

function readState(): ClientWorkspaceState {
  if (!CLIENT_WORKSPACE_ORGANISATION_ID) {
    return { organisationId: "", people: [], trackers: [], items: [], reminderPreference: reminders };
  }
  if (typeof window === "undefined") {
    return { organisationId: CLIENT_WORKSPACE_ORGANISATION_ID, people: [], trackers: [], items: [], reminderPreference: reminders };
  }
  const storageKey = getClientProfileStorageKey(STORAGE_KEY);
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      const state = JSON.parse(raw) as Partial<ClientWorkspaceState>;
      const belongsToCurrentOrganisation =
        state.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID;
      const people = Array.isArray(state.people)
        ? state.people.filter((person) =>
          Boolean(person && person.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID),
        )
        : [];
      return {
        organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
        people: people.length ? people : getDefaultPeople(),
        trackers: Array.isArray(state.trackers)
          ? state.trackers.filter((tracker) =>
            Boolean(tracker && tracker.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID),
          )
          : [],
        items: Array.isArray(state.items)
          ? state.items.filter((item) =>
            Boolean(item && item.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID),
          )
          : [],
        reminderPreference: belongsToCurrentOrganisation
          ? { ...reminders, ...state.reminderPreference }
          : reminders,
      };
    } catch (error) {
      console.error("Could not read client workspace prototype data.", error);
    }
  }
  return {
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    people: getDefaultPeople(),
    trackers: [],
    items: [],
    reminderPreference: reminders,
  };
}

function writeState(state: ClientWorkspaceState) {
  if (typeof window === "undefined" || !CLIENT_WORKSPACE_ORGANISATION_ID) return false;
  let otherOrganisationData: Partial<Pick<ClientWorkspaceState, "people" | "trackers" | "items">> = {};
  const storageKey = getClientProfileStorageKey(STORAGE_KEY);
  const previous = localStorage.getItem(storageKey);
  if (previous) {
    try {
      const parsed = JSON.parse(previous) as Partial<ClientWorkspaceState>;
      otherOrganisationData = {
        people: Array.isArray(parsed.people) ? parsed.people.filter((entry) => entry && entry.organisationId !== CLIENT_WORKSPACE_ORGANISATION_ID) : [],
        trackers: Array.isArray(parsed.trackers) ? parsed.trackers.filter((entry) => entry && entry.organisationId !== CLIENT_WORKSPACE_ORGANISATION_ID) : [],
        items: Array.isArray(parsed.items) ? parsed.items.filter((entry) => entry && entry.organisationId !== CLIENT_WORKSPACE_ORGANISATION_ID) : [],
      };
    } catch (error) {
      console.error("Could not preserve existing client workspace prototype data; no data was overwritten.", error);
      return false;
    }
  }
  localStorage.setItem(storageKey, JSON.stringify({
    ...state,
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    people: [...(otherOrganisationData.people || []), ...state.people.filter((person) => person.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID)],
    trackers: [...(otherOrganisationData.trackers || []), ...state.trackers.filter((tracker) => tracker.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID)],
    items: [...(otherOrganisationData.items || []), ...state.items.filter((item) => item.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID)],
  }));
  dispatchUpdate();
  return true;
}

function audit(action: string, entityType: string, entityId: string, entityName: string, previousValue: unknown, newValue: unknown, context: string) {
  addAuditEvent({
    recordId: entityType === "record" ? entityId : "",
    recordName: entityName,
    organisation: getClient(CLIENT_WORKSPACE_ORGANISATION_ID)?.company || CLIENT_WORKSPACE_ORGANISATION_ID,
    user: CLIENT_WORKSPACE_USER,
    action,
    field: "",
    previousValue: previousValue === undefined ? "" : JSON.stringify(previousValue),
    newValue: newValue === undefined ? "" : JSON.stringify(newValue),
    entityType,
    entityId,
    entityName,
    context,
  });
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function getClientWorkspaceState() {
  return readState();
}

export function getAllClientWorkspaceEntries(): Pick<ClientWorkspaceState, "people" | "trackers" | "items"> {
  if (typeof window === "undefined") return { people: [], trackers: [], items: [] };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { people: getDefaultPeople(), trackers: [], items: [] };
  }
  try {
    const stored: Partial<ClientWorkspaceState> = JSON.parse(raw);
    return {
      people: Array.isArray(stored.people)
        ? stored.people.filter((person) => Boolean(person?.organisationId && person.id && person.name))
        : getDefaultPeople(),
      trackers: Array.isArray(stored.trackers)
        ? stored.trackers.filter((tracker) => Boolean(tracker?.organisationId && tracker.id))
        : [],
      items: Array.isArray(stored.items)
        ? stored.items.filter((item) => Boolean(item?.organisationId && item.id && item.trackerId))
        : [],
    };
  } catch (error) {
    console.error("Could not read the shared client workspace directory.", error);
    return { people: getDefaultPeople(), trackers: [], items: [] };
  }
}

export function addResponsiblePerson(input: Omit<ResponsiblePerson, "id" | "organisationId">) {
  const state = readState();
  const email = input.email?.trim().toLowerCase();
  if (!input.name.trim()) return { success: false as const, message: "Responsible person name is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false as const, message: "Enter a valid email address." };
  if (email && state.people.some((person) => person.email?.toLowerCase() === email)) return { success: false as const, message: "A person with this organisation email already exists." };
  const person: ResponsiblePerson = {
    ...input,
    id: makeId("person"),
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    name: input.name.trim(),
    email: email || undefined,
    role: input.role?.trim() || undefined,
  };
  if (!writeState({ ...state, people: [...state.people, person] })) return { success: false as const, message: "Existing workspace data could not be read, so this person was not saved." };
  audit("Responsible person added", "responsible person", person.id, person.name, undefined, person, "Prototype contact only; no user account or invitation was created.");
  return { success: true as const, person };
}

export function saveWorkTracker(input: Omit<WorkTracker, "id" | "organisationId" | "createdAt" | "updatedAt">, id?: string) {
  const state = readState();
  const existing = id ? state.trackers.find((tracker) => tracker.id === id) : undefined;
  if (!input.name.trim()) return { success: false as const, message: "Tracker name is required." };
  if (!validDate(input.startDate) || !validDate(input.endDate)) return { success: false as const, message: "Enter valid tracker start and end dates." };
  if (input.startDate > input.endDate) return { success: false as const, message: "Tracker start date cannot be after its end date." };
  if (!state.people.some((person) => person.id === input.ownerId && person.active)) return { success: false as const, message: "Choose an active owner from this organisation." };
  const now = new Date().toISOString();
  const tracker: WorkTracker = {
    ...input,
    id: existing?.id || makeId("tracker"),
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (!writeState({ ...state, trackers: existing ? state.trackers.map((item) => item.id === tracker.id ? tracker : item) : [...state.trackers, tracker] })) return { success: false as const, message: "Existing workspace data could not be read, so the tracker was not saved." };
  audit(existing ? "Client edited tracker" : "Client created tracker", "work tracker", tracker.id, tracker.name, existing, tracker, "Client workspace tracker metadata.");
  if (existing && (existing.startDate !== tracker.startDate || existing.endDate !== tracker.endDate || existing.periodType !== tracker.periodType)) {
    audit("Tracker schedule changed", "work tracker", tracker.id, tracker.name,
      { periodType: existing.periodType, startDate: existing.startDate, endDate: existing.endDate },
      { periodType: tracker.periodType, startDate: tracker.startDate, endDate: tracker.endDate },
      "Client workspace tracker schedule update.");
  }
  if (existing && existing.ownerId !== tracker.ownerId) {
    audit("Tracker owner changed", "work tracker", tracker.id, tracker.name, existing.ownerId, tracker.ownerId, "Client workspace owner reassignment.");
  }
  if (existing && existing.status !== tracker.status) {
    audit(`Tracker ${tracker.status.toLowerCase()}`, "work tracker", tracker.id, tracker.name, existing.status, tracker.status, "Client workspace tracker state change.");
  }
  return { success: true as const, tracker };
}

export function saveChecklistItem(input: Omit<ChecklistItem, "id" | "organisationId" | "responsiblePersonName" | "createdAt" | "updatedAt" | "completedDate">, id?: string) {
  const state = readState();
  const existing = id ? state.items.find((item) => item.id === id) : undefined;
  const tracker = state.trackers.find((item) => item.id === input.trackerId);
  const person = state.people.find((item) => item.id === input.responsiblePersonId && item.active);
  if (!tracker || tracker.status === "Archived") return { success: false as const, message: "Choose an active tracker in this organisation." };
  if (!input.task.trim()) return { success: false as const, message: "Task or deliverable is required." };
  if (!person) return { success: false as const, message: "Choose an active responsible person." };
  if (input.status !== "Awaiting Confirmation" && !validDate(input.targetDate)) return { success: false as const, message: "Enter a valid target date." };
  if (input.targetDate && !validDate(input.targetDate)) return { success: false as const, message: "Enter a valid target date." };
  if (input.responsibleEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.responsibleEmail)) return { success: false as const, message: "Enter a valid responsible-person email address." };
  if (input.status === "Completed" && !input.completionEvidence?.trim()) return { success: false as const, message: "Add completion evidence before saving an item as completed." };
  if (existing?.status === "Completed" && !input.progressNotes?.trim()) return { success: false as const, message: "Add a note when changing a completed item." };
  if (existing?.targetDate && input.targetDate > existing.targetDate && new Date(`${existing.targetDate}T23:59:59`) < new Date() && !input.progressNotes?.trim()) {
    return { success: false as const, message: "Add a reason when moving an overdue item to a later date." };
  }
  const now = new Date().toISOString();
  const item: ChecklistItem = {
    ...input,
    id: existing?.id || makeId("item"),
    organisationId: CLIENT_WORKSPACE_ORGANISATION_ID,
    task: input.task.trim(),
    responsiblePersonName: person.name,
    responsibleEmail: input.responsibleEmail?.trim() || person.email,
    progressNotes: input.progressNotes?.trim() || undefined,
    nextAction: input.nextAction?.trim() || undefined,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    completedDate: input.status === "Completed" ? existing?.completedDate || localDate() : undefined,
  };
  if (!writeState({ ...state, items: existing ? state.items.map((candidate) => candidate.id === item.id ? item : candidate) : [...state.items, item] })) return { success: false as const, message: "Existing workspace data could not be read, so the checklist item was not saved." };
  if (existing) {
    audit("Checklist item edited", "checklist item", item.id, item.task, existing, item, `Tracker: ${tracker.name}`);
    if (existing.responsiblePersonId !== item.responsiblePersonId) audit("Responsible person changed", "checklist item", item.id, item.task, existing.responsiblePersonName, item.responsiblePersonName, `Tracker: ${tracker.name}`);
    if (existing.targetDate !== item.targetDate) audit("Due date changed", "checklist item", item.id, item.task, existing.targetDate, item.targetDate, `Tracker: ${tracker.name}`);
    if (existing.priority !== item.priority) audit("Priority changed", "checklist item", item.id, item.task, existing.priority, item.priority, `Tracker: ${tracker.name}`);
    if (existing.status !== item.status) audit(`Checklist item status changed`, "checklist item", item.id, item.task, existing.status, item.status, `Tracker: ${tracker.name}`);
    if (existing.progressNotes !== item.progressNotes || existing.completionEvidence !== item.completionEvidence) {
      audit("Checklist progress updated", "checklist item", item.id, item.task,
        { progressNotes: existing.progressNotes, completionEvidence: existing.completionEvidence },
        { progressNotes: item.progressNotes, completionEvidence: item.completionEvidence },
        `Tracker: ${tracker.name}`);
    }
  } else {
    audit("Checklist item added", "checklist item", item.id, item.task, undefined, item, `Tracker: ${tracker.name}`);
  }
  return { success: true as const, item };
}

export function deleteDraftChecklistItem(id: string) {
  const state = readState();
  const item = state.items.find((candidate) => candidate.id === id && candidate.organisationId === CLIENT_WORKSPACE_ORGANISATION_ID);
  if (!item || item.status !== "Not Started") return false;
  if (!writeState({ ...state, items: state.items.filter((candidate) => candidate.id !== id) })) return false;
  audit("Checklist item deleted while draft", "checklist item", item.id, item.task, item, undefined, `Tracker ID: ${item.trackerId}`);
  return true;
}

export function updateChecklistItem(id: string, status: ChecklistStatus, note?: string) {
  const state = readState();
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return { success: false as const, message: "Checklist item was not found." };
  if (["Blocked", "Carry Forward", "Skipped"].includes(status) && !note?.trim()) return { success: false as const, message: "Enter a reason or note for this status." };
  if (status === "Skipped" && !item.clientCanSkip) return { success: false as const, message: "This checklist item does not permit client skipping." };
  if (status === "Completed" && !note?.trim()) return { success: false as const, message: "Add completion evidence before completing this item." };
  if (item.status === "Completed" && !note?.trim()) return { success: false as const, message: "Add a note when changing a completed item." };
  const updated: ChecklistItem = {
    ...item,
    status,
    blockedReason: status === "Blocked" ? note?.trim() : undefined,
    progressNotes: status === "Skipped" ? note?.trim() : note?.trim() || item.progressNotes,
    carryForwardReason: status === "Carry Forward" ? note?.trim() : undefined,
    completedDate: status === "Completed" ? localDate() : undefined,
    completionEvidence: status === "Completed" ? note?.trim() : item.completionEvidence,
    updatedAt: new Date().toISOString(),
  };
  if (!writeState({ ...state, items: state.items.map((candidate) => candidate.id === id ? updated : candidate) })) return { success: false as const, message: "Existing workspace data could not be read, so the checklist item was not updated." };
  const tracker = state.trackers.find((candidate) => candidate.id === item.trackerId);
  const action = status === "In Progress" ? "Task started"
    : status === "Completed" ? "Task completed"
    : status === "Blocked" ? "Task blocked"
    : status === "Skipped" ? "Task skipped"
    : status === "Carry Forward" ? "Task carried forward"
    : "Checklist item edited";
  audit(action, "checklist item", id, item.task, item.status, status, `Tracker: ${tracker?.name || item.trackerId}${note ? `; note: ${note.trim()}` : ""}`);
  return { success: true as const, item: updated };
}

export function carryForwardChecklistItem(id: string, targetDate: string, reason: string) {
  const state = readState();
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return { success: false as const, message: "Checklist item was not found." };
  if (item.status === "Completed") return { success: false as const, message: "Completed items are not carried forward by default." };
  if (!validDate(targetDate) || !reason.trim()) return { success: false as const, message: "Choose a valid new target date and provide a reason." };
  const updated: ChecklistItem = { ...item, status: "Carry Forward", carryForwardReason: reason.trim(), updatedAt: new Date().toISOString() };
  const tracker = state.trackers.find((candidate) => candidate.id === item.trackerId);
  let newTracker: WorkTracker | undefined;
  if (tracker) {
    const start = new Date(`${targetDate}T00:00:00`);
    const end = new Date(start);
    if (tracker.periodType === "Weekly tracker") end.setDate(end.getDate() + 6);
    if (tracker.periodType === "Monthly tracker") end.setMonth(end.getMonth() + 1, 0);
    if (tracker.periodType === "Daily checklist") end.setDate(end.getDate());
    if (tracker.periodType === "Custom tracker") {
      const currentDuration = Math.max(0, Math.round((new Date(`${tracker.endDate}T00:00:00`).getTime() - new Date(`${tracker.startDate}T00:00:00`).getTime()) / 86400000));
      end.setDate(end.getDate() + currentDuration);
    }
    const created = saveWorkTracker({
      name: `${tracker.name} - ${targetDate}`,
      description: tracker.description,
      periodType: tracker.periodType,
      startDate: targetDate,
      endDate: formatDate(end),
      ownerId: tracker.ownerId,
      reminderPreference: tracker.reminderPreference,
      status: "Active",
    });
    if (!created.success) return created;
    newTracker = created.tracker;
  }
  const copied: ChecklistItem = {
    ...item,
    id: makeId("item"),
    trackerId: newTracker?.id || item.trackerId,
    targetDate,
    status: "Not Started",
    completedDate: undefined,
    carryForwardReason: reason.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const latest = readState();
  if (!writeState({ ...latest, items: [...latest.items.map((candidate) => candidate.id === id ? updated : candidate), copied] })) return { success: false as const, message: "Existing workspace data could not be read, so the item was not carried forward." };
  audit("Task carried forward", "checklist item", id, item.task, item.targetDate, targetDate, `Reason: ${reason.trim()}; new item ${copied.id}${newTracker ? `; tracker ${newTracker.name}` : ""}`);
  return { success: true as const, item: copied, tracker: newTracker };
}

export function duplicateTrackerForPeriod(trackerId: string, startDate: string, endDate: string, itemDates: Record<string, string>, selectedItemIds: string[]) {
  const state = readState();
  const tracker = state.trackers.find((item) => item.id === trackerId);
  if (!tracker) return { success: false as const, message: "Tracker was not found." };
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return { success: false as const, message: "Choose a valid period where start date is not after end date." };
  const selected = state.items.filter((item) => selectedItemIds.includes(item.id) && item.trackerId === trackerId && !["Completed", "Skipped", "Carry Forward"].includes(item.status));
  if (selected.some((item) => !validDate(itemDates[item.id]) || itemDates[item.id] < startDate || itemDates[item.id] > endDate)) return { success: false as const, message: "Choose a valid new target date within the copied tracker period for every selected item." };
  const created = saveWorkTracker({
    name: `${tracker.name} (copy)`,
    description: tracker.description,
    periodType: tracker.periodType,
    startDate,
    endDate,
    ownerId: tracker.ownerId,
    reminderPreference: tracker.reminderPreference,
    status: "Draft",
  });
  if (!created.success) return created;
  const newItems = selected.map((item) => ({
    ...item,
    id: makeId("item"),
    trackerId: created.tracker.id,
    targetDate: itemDates[item.id],
    status: "Not Started" as const,
    completedDate: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  const latest = readState();
  if (!writeState({ ...latest, items: [...latest.items, ...newItems] })) return { success: false as const, message: "Existing workspace data could not be read, so the tracker copy was not saved." };
  audit("Tracker duplicated for new period", "work tracker", created.tracker.id, created.tracker.name, tracker.id, { startDate, endDate, copiedItems: newItems.map((item) => item.id) }, "Completed, skipped, and carried-forward items were excluded.");
  return { success: true as const, tracker: created.tracker, items: newItems };
}

export function saveReminderPreferences(preference: ReminderPreference) {
  const validation = validateReminderPreference(preference);
  if (validation) return { success: false as const, message: validation };
  const state = readState();
  const previous = state.reminderPreference;
  const next = {
    ...preference,
    weekday: preference.summaryFrequency === "Weekly on selected weekday" ? preference.weekday || "Monday" : preference.weekday,
    timeZone: "Africa/Johannesburg",
  };
  if (!writeState({ ...state, reminderPreference: next })) return { success: false as const, message: "Existing workspace data could not be read, so reminder preferences were not saved." };
  audit("Reminder preference changed", "reminder preference", CLIENT_WORKSPACE_ORGANISATION_ID, "Account reminder preferences", previous, next, "Prototype preference saved; email delivery is not active.");
  return { success: true as const, preference: next };
}

export function validateReminderPreference(preference: ReminderPreference): string | undefined {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preference.time)) return "Choose a valid reminder time.";
  if (preference.summaryFrequency === "Weekly on selected weekday" && !preference.weekday) return "Choose a weekday.";
  if (preference.summaryFrequency === "Monthly" && preference.monthlyRule === "selected-day" &&
    (!Number.isInteger(preference.monthlyDay) || (preference.monthlyDay || 0) < 1 || (preference.monthlyDay || 0) > 31)) return "Choose a monthly day from 1 to 31.";
  if (preference.summaryFrequency === "Custom") {
    if (!Number.isInteger(preference.customInterval) || (preference.customInterval || 0) < 1 || (preference.customInterval || 0) > 365) return "Custom interval must be a whole number from 1 to 365.";
    if (!preference.customFrequency) return "Choose a custom frequency.";
    if (preference.customFrequency === "week" && !(preference.customWeekdays?.length)) return "Select at least one weekday.";
    if (!validDate(preference.startDate || "")) return "Choose a valid custom schedule start date.";
    if (preference.endDate && (!validDate(preference.endDate) || preference.endDate < (preference.startDate || ""))) return "End date must be valid and on or after the start date.";
  }
  return undefined;
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) &&
    `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}` === value;
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
