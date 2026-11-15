"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import ClientForm from "@/components/clients/ClientForm";
import CalendarAgendaView from "@/components/client/calendar/CalendarAgendaView";
import CalendarDayPanel from "@/components/client/calendar/CalendarDayPanel";
import CalendarMonthView from "@/components/client/calendar/CalendarMonthView";
import CalendarWeekView from "@/components/client/calendar/CalendarWeekView";
import {
  formatCalendarDate,
  formatCalendarMonth,
  getCalendarWeekDays,
  getMonthGridDays,
  monthKeyFromDate,
  shiftCalendarDate,
  shiftMonth,
} from "@/components/client/calendar/calendarUtils";
import { Client, getClient, getClients } from "@/lib/clientStore";
import {
  getConsultantActivities,
  filterConsultantActivities,
} from "@/lib/consultantActivities";
import { clientBusinessToday } from "@/lib/clientWorkspaceSelectors";
import {
  getAllClientWorkspaceEntries,
  type ClientWorkspaceState,
} from "@/lib/clientWorkspaceStore";
import {
  ConsultantException,
  ConsultantRecurringSchedule,
  ConsultantWorkItem,
  ConsultantWorkSnapshot,
  loadConsultantWorkSnapshot,
} from "@/lib/consultantWork";
import { daysUntil, getAuditEvents, getCommunications, getRecords, type AuditEvent, type CommunicationEvent, type MonitoredRecord } from "@/lib/recordStore";
import { getRecurringTasks } from "@/lib/recurringTasks/taskStore";
import type { RecurringTask } from "@/lib/recurringTasks/types";
import {
  getActivitiesForDate,
  getActivitiesForMonth,
  getActivitiesForWeek,
  type ClientActivityStatusFilter,
  type ClientActivityTypeFilter,
} from "@/lib/clientActivities";

type DetailTab = "overview" | "records" | "work" | "calendar" | "notifications" | "activity";
type WorkTab = "tasks" | "checklists" | "recurring" | "completed" | "exceptions";
type CalendarView = "month" | "week" | "agenda";

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "records", label: "Records" },
  { id: "work", label: "Work" },
  { id: "calendar", label: "Calendar" },
  { id: "notifications", label: "Notifications" },
  { id: "activity", label: "Activity" },
];

const workTabs: Array<{ id: WorkTab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "checklists", label: "Checklists" },
  { id: "recurring", label: "Recurring" },
  { id: "completed", label: "Completed" },
  { id: "exceptions", label: "Exceptions" },
];

const emptySnapshot: ConsultantWorkSnapshot = {
  organisations: [],
  people: [],
  tasks: [],
  checklists: [],
  recurring: [],
  completed: [],
  exceptions: [],
};

const materialAuditActions = new Set([
  "Client monitored record created",
  "Client monitored record edited",
  "Expiry date changed",
  "Client replacement date confirmed",
  "Record created from Calendar",
  "Follow-up created from Calendar",
  "Recurring task created",
  "Recurring task edited",
  "Recurring task schedule changed",
  "Recurring task owner changed",
  "Recurring task started",
  "Recurring task completed",
  "Recurring task skipped",
  "Recurring task failed",
  "Recurring task paused",
  "Recurring task resumed",
  "Task created from Calendar",
  "Task started",
  "Task completed",
  "Task skipped",
  "Task failed",
  "Client created tracker",
  "Checklist created",
  "Checklist item added",
  "Checklist item completed",
  "Checklist item status changed",
  "Responsible person changed",
  "Due date changed",
  "Reminder approved",
  "Reminder edited",
  "Reminder suppressed",
]);

const calendarSelectClass = "min-h-10 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700";

function moveTab<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  active: T,
  onSelect: (value: T) => void,
) {
  let nextIndex = values.indexOf(active);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (nextIndex + 1) % values.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (nextIndex - 1 + values.length) % values.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = values.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  onSelect(values[nextIndex]);
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons?.[nextIndex]?.focus();
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("overdue") || normalized.includes("failed") || normalized.includes("expired")) return "border-red-200 bg-red-50 text-red-800";
  if (normalized.includes("completed")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (normalized.includes("blocked")) return "border-amber-200 bg-amber-50 text-amber-900";
  if (normalized.includes("awaiting")) return "border-violet-200 bg-violet-50 text-violet-800";
  if (normalized.includes("paused") || normalized.includes("cancelled")) return "border-slate-200 bg-slate-100 text-slate-700";
  if (normalized.includes("due today") || normalized.includes("in progress")) return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-teal-200 bg-teal-50 text-teal-800";
}

function StatusBadge({ children }: { children: string }) {
  return <span className={`inline-flex cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(children)}`}>{children}</span>;
}

function severityClass(severity: ConsultantException["severity"]) {
  if (severity === "Critical") return "border-red-300 bg-red-50 text-red-900";
  if (severity === "High") return "border-orange-300 bg-orange-50 text-orange-900";
  if (severity === "Medium") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function SeverityBadge({ severity }: { severity: ConsultantException["severity"] }) {
  return <span className={`inline-flex cursor-default rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(severity)}`}>{severity}</span>;
}

function formatAuditDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function communicationDecision(communication: CommunicationEvent) {
  if (communication.decision === "approved") return "Approved";
  if (communication.decision === "suppressed" || communication.deliveryStatus === "Suppressed") return "Suppressed";
  if (communication.decision === "draft" || communication.deliveryStatus === "Draft") return "Awaiting Review";
  return communication.decision || "Awaiting Review";
}

function auditEventOrganisationId(event: AuditEvent) {
  const eventWithOrganisation = event as AuditEvent & { organisationId?: string };
  if (eventWithOrganisation.organisationId) return eventWithOrganisation.organisationId;
  return event.context?.match(/Organisation ID:\s*([^;,]+)/i)?.[1]?.trim() || "";
}

function linkedOrganisationIds(
  event: AuditEvent,
  allRecords: MonitoredRecord[],
  allTasks: RecurringTask[],
  workspaceEntries: Pick<ClientWorkspaceState, "trackers" | "items">,
  clients: Client[],
) {
  const entityId = event.entityId || event.recordId;
  if (!entityId) return [];
  const type = (event.entityType || "").toLowerCase();
  if (type.includes("record") || event.recordId) {
    return allRecords.filter((record) => record.id === entityId).map((record) => record.organisationId);
  }
  if (type.includes("recurring") || type === "task") {
    return allTasks.filter((task) => task.id === entityId).map((task) => task.organisationId);
  }
  if (type.includes("checklist item")) {
    return workspaceEntries.items.filter((item) => item.id === entityId).map((item) => item.organisationId);
  }
  if (type.includes("tracker")) {
    return workspaceEntries.trackers.filter((tracker) => tracker.id === entityId).map((tracker) => tracker.organisationId);
  }
  if (type === "client" || type === "organisation") {
    return clients.filter((client) => client.id === entityId).map((client) => client.id);
  }
  return [];
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const [client, setClient] = useState<Client | null>(null);
  const [allRecords, setAllRecords] = useState<MonitoredRecord[]>([]);
  const [allTasks, setAllTasks] = useState<RecurringTask[]>([]);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [workspaceEntries, setWorkspaceEntries] = useState<Pick<ClientWorkspaceState, "trackers" | "items">>({ trackers: [], items: [] });
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [activeWorkTab, setActiveWorkTab] = useState<WorkTab>("tasks");
  const [expandedChecklistId, setExpandedChecklistId] = useState("");
  const today = clientBusinessToday();

  const load = useCallback(() => {
    const records = Object.values(getRecords());
    const tasks = getRecurringTasks();
    const directory = getAllClientWorkspaceEntries();
    setClient(getClient(id) || null);
    setClients(getClients());
    setAllRecords(records);
    setAllTasks(tasks);
    setSnapshot(loadConsultantWorkSnapshot());
    setCommunications(getCommunications());
    setAuditEvents(getAuditEvents());
    setWorkspaceEntries({ trackers: directory.trackers, items: directory.items });
  }, [id]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(load);
    window.addEventListener("deadline-monitor-updated", load);
    window.addEventListener("deadline-monitor-clients-updated", load);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("deadline-monitor-updated", load);
      window.removeEventListener("deadline-monitor-clients-updated", load);
    };
  }, [id, load]);

  const records = useMemo(() => allRecords.filter((record) => record.organisationId === id), [allRecords, id]);
  const tasks = useMemo(() => snapshot.tasks.filter((item) => item.organisationId === id), [snapshot.tasks, id]);
  const checklists = useMemo(() => snapshot.checklists.filter((checklist) => checklist.organisationId === id), [snapshot.checklists, id]);
  const recurring = useMemo(() => snapshot.recurring.filter((schedule) => schedule.task.organisationId === id), [snapshot.recurring, id]);
  const completed = useMemo(() => snapshot.completed.filter((item) => item.organisationId === id), [snapshot.completed, id]);
  const exceptions = useMemo(() => snapshot.exceptions.filter((item) => item.organisationId === id), [snapshot.exceptions, id]);
  const nearest = records.filter((record) => record.status !== "Completed").map((record) => record.followUp || record.expiryDate).filter(Boolean).sort()[0];

  const relatedCommunications = useMemo(() => {
    if (!client) return [];
    const organisationRecords = new Map(records.map((record) => [record.id, record.name]));
    const organisationTasks = new Map(allTasks.filter((task) => task.organisationId === id).map((task) => [task.id, task.name]));
    return communications.filter((communication) => {
      if ((communication.organisation || "").trim().toLocaleLowerCase() !== client.company.trim().toLocaleLowerCase()) return false;
      if (communication.recordId && !organisationRecords.has(communication.recordId)) return false;
      if (communication.relatedTaskId && !organisationTasks.has(communication.relatedTaskId)) return false;
      return true;
    }).sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  }, [allTasks, client, communications, id, records]);

  const materialActivity = useMemo(() => {
    if (!client) return [];
    return auditEvents.filter((event) => {
      if (!materialAuditActions.has(event.action)) return false;
      const explicitOrganisationId = auditEventOrganisationId(event);
      if (explicitOrganisationId) return explicitOrganisationId === id;
      const linkedIds = linkedOrganisationIds(event, allRecords, allTasks, workspaceEntries, clients);
      if (linkedIds.length) return linkedIds.every((organisationId) => organisationId === id);
      return event.organisation.trim().toLocaleLowerCase() === client.company.trim().toLocaleLowerCase();
    }).sort((left, right) =>
      Date.parse(right.timestamp || right.date) - Date.parse(left.timestamp || left.date),
    );
  }, [allRecords, allTasks, auditEvents, client, clients, id, workspaceEntries]);

  const allCalendarActivities = useMemo(
    () => getConsultantActivities(snapshot, today).filter((activity) => activity.organisationId === id),
    [id, snapshot, today],
  );
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarType, setCalendarType] = useState<ClientActivityTypeFilter>("all");
  const [calendarStatus, setCalendarStatus] = useState<ClientActivityStatusFilter>("all");
  const [calendarPerson, setCalendarPerson] = useState("all");
  const [calendarPriority, setCalendarPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const people = useMemo(
    () => [...new Set(snapshot.people.filter((person) => person.organisationId === id).map((person) => person.name).filter(Boolean))].sort(),
    [id, snapshot.people],
  );
  const filteredCalendarActivities = useMemo(
    () => filterConsultantActivities(allCalendarActivities, {
      organisationId: id,
      activityType: "all",
      status: calendarStatus,
      responsiblePerson: calendarPerson,
      priority: calendarPriority,
    }).filter((activity) =>
      calendarType === "all" ||
      (calendarType === "records" && ["record_expiry", "record_follow_up"].includes(activity.activityType)) ||
      (calendarType === "tasks" && activity.activityType === "recurring_task") ||
      (calendarType === "checklist" && activity.activityType === "checklist_item") ||
      (calendarType === "follow_ups" && ["record_follow_up", "follow_up"].includes(activity.activityType)),
    ),
    [allCalendarActivities, calendarPerson, calendarPriority, calendarStatus, calendarType, id],
  );
  const monthActivities = useMemo(
    () => getActivitiesForMonth(filteredCalendarActivities, calendarMonth),
    [calendarMonth, filteredCalendarActivities],
  );
  const weekActivities = useMemo(
    () => getActivitiesForWeek(filteredCalendarActivities, selectedDate),
    [filteredCalendarActivities, selectedDate],
  );
  const selectedActivities = useMemo(
    () => getActivitiesForDate(filteredCalendarActivities, selectedDate),
    [filteredCalendarActivities, selectedDate],
  );
  const calendarDays = useMemo(() => getMonthGridDays(calendarMonth), [calendarMonth]);
  const calendarWeekDays = useMemo(() => getCalendarWeekDays(selectedDate), [selectedDate]);
  const calendarHeading = calendarView === "week"
    ? `${formatCalendarDate(calendarWeekDays[0], { weekday: "short", day: "numeric", month: "short" })} – ${formatCalendarDate(calendarWeekDays[6], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`
    : formatCalendarMonth(calendarMonth);
  const visibleCalendarActivityCount = calendarView === "week" ? weekActivities.length : monthActivities.length;

  function navigateCalendarPeriod(offset: number) {
    if (calendarView === "week") {
      const date = shiftCalendarDate(selectedDate, offset * 7);
      setSelectedDate(date);
      setCalendarMonth(monthKeyFromDate(date));
      return;
    }
    const month = shiftMonth(calendarMonth, offset);
    setCalendarMonth(month);
    setSelectedDate(`${month}-01`);
  }

  function goToToday() {
    setCalendarMonth(today.slice(0, 7));
    setSelectedDate(today);
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    if (monthKeyFromDate(date) !== calendarMonth) setCalendarMonth(monthKeyFromDate(date));
    setDayPanelOpen(true);
  }

  function renderWorkTable(items: ConsultantWorkItem[]) {
    if (!items.length) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">No work is available for this organisation.</p>;
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>{["Task", "Related To", "Responsible", "Due", "Priority", "Status", "Source"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={`${item.organisationId}:${item.id}`} className="cursor-default align-top">
                <td className="max-w-xs px-3 py-3 font-semibold text-slate-950">{item.task}</td>
                <td className="px-3 py-3 text-slate-700">{item.related}</td>
                <td className="px-3 py-3 text-slate-700">{item.responsible}</td>
                <td className="px-3 py-3 text-slate-700">{item.dueDate || "—"}{item.dueTime && <span className="ml-1">· {item.dueTime}</span>}</td>
                <td className="px-3 py-3 text-slate-700">{item.priority || "—"}</td>
                <td className="px-3 py-3"><StatusBadge>{item.status}</StatusBadge></td>
                <td className="px-3 py-3 text-slate-700">{item.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!client) {
    return <WorkspaceShell eyebrow="Client Management" title="Client Not Found"><div className="p-8"><p className="text-slate-600">This client does not exist in local storage.</p><Link href="/clients" className="mt-4 inline-block cursor-pointer font-semibold text-teal-700">Back to Clients</Link></div></WorkspaceShell>;
  }

  if (editing) {
    return <WorkspaceShell eyebrow="Client Management" title="Edit Client"><div className="mx-auto max-w-4xl space-y-4 p-5 lg:p-8"><button type="button" onClick={() => setEditing(false)} className="cursor-pointer font-semibold text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">← Back to Client</button><ClientForm key={client.id} initialClient={client} onSaved={(saved) => { setClient(saved); setEditing(false); }} /></div></WorkspaceShell>;
  }

  const linkedRecurringCount = allTasks.filter((task) => task.organisationId === id).length;

  return (
    <WorkspaceShell eyebrow="Client Management" title={client.company} actions={<button type="button" onClick={() => setEditing(true)} className="min-h-[44px] cursor-pointer rounded-xl bg-teal-600 px-5 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Edit Client</button>}>
      <div className="space-y-5 p-4 sm:p-5 lg:p-7">
        <div role="tablist" aria-label="Client detail sections" className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              id={`client-detail-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`client-detail-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => moveTab(event, detailTabs.map((item) => item.id), activeTab, setActiveTab)}
              className={`min-h-12 shrink-0 cursor-pointer border-b-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:px-5 ${activeTab === tab.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-600 hover:bg-slate-50"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section id={`client-detail-panel-${activeTab}`} role="tabpanel" aria-labelledby={`client-detail-tab-${activeTab}`} className="min-w-0">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Service package", client.servicePackage],
                  ["Service status", client.status],
                  ["Monitored records", records.length],
                  ["Recurring tasks", linkedRecurringCount],
                ].map(([label, value]) => <div key={label} className="cursor-default rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-950">{value}</p></div>)}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Service details</h2>
                <p className="mt-2 text-slate-600">Organisation: {client.company}</p>
                <p className="mt-2 text-slate-600">Registration number: {client.registrationNumber || "Not provided"}</p>
                <p className="mt-2 text-slate-600">Reminder preference: {client.reminderPreference}</p>
                <p className="mt-2 text-slate-600">Next action: {nearest || "No pending action"}</p>
                <Link href={`/monitored-records?organisation=${encodeURIComponent(client.company)}`} className="mt-4 inline-block cursor-pointer font-semibold text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">View monitored records</Link>
              </section>
              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Authorised contacts</h2>
                {client.contacts.filter((contact) => contact.authorised).map((contact) => <article key={contact.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{contact.name}{contact.primary ? " · Primary" : ""}</h3><p className="mt-1 text-sm text-slate-600">{contact.role || "Authorised contact"} · {contact.email}{contact.phone ? ` · ${contact.phone}` : ""}</p></article>)}
                {!client.contacts.some((contact) => contact.authorised) && <p className="text-slate-600">No authorised contacts.</p>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="text-xl font-bold">Monitored records</h2>
                {records.length ? <ul className="mt-3 space-y-2">{records.map((record) => <li key={record.id}><Link href={`/monitored-records/${encodeURIComponent(record.id)}`} className="cursor-pointer font-semibold text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">{record.name}</Link><span className="ml-2 text-sm text-slate-500">{record.status} · {record.expiryDate || "No expiry date"}</span></li>)}</ul> : <p className="mt-3 text-slate-600">No records linked to this organisation.</p>}
              </section>
            </div>
          )}

          {activeTab === "records" && (
            <section aria-label="Client monitored records">
              {records.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Record", "Category / Type", "Responsible", "Expiry", "Days Remaining", "Risk", "Status", "Next Action"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((record) => {
                        const remaining = daysUntil(record.expiryDate);
                        return <tr key={`${record.organisationId}:${record.id}`} className="cursor-default align-top">
                          <td className="px-3 py-3 font-semibold"><Link href={`/monitored-records/${encodeURIComponent(record.id)}`} className="cursor-pointer text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">{record.name}</Link></td>
                          <td className="px-3 py-3">{record.category} · {record.category2}</td>
                          <td className="px-3 py-3">{record.contact || "Unassigned"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{record.expiryDate || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-3">{Number.isFinite(remaining) ? remaining < 0 ? `${Math.abs(remaining)} days overdue` : `${remaining} days` : "—"}</td>
                          <td className="px-3 py-3">{record.risk}</td>
                          <td className="px-3 py-3"><StatusBadge>{record.status}</StatusBadge></td>
                          <td className="max-w-xs px-3 py-3">{record.nextAction || "—"}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No monitored records are available for this organisation.</p>}
            </section>
          )}

          {activeTab === "work" && (
            <section className="space-y-4">
              <div role="tablist" aria-label="Client work sections" className="flex overflow-x-auto border-b border-slate-200">
                {workTabs.map((tab) => (
                  <button
                    key={tab.id}
                    id={`client-work-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeWorkTab === tab.id}
                    aria-controls={`client-work-panel-${tab.id}`}
                    tabIndex={activeWorkTab === tab.id ? 0 : -1}
                    onClick={() => setActiveWorkTab(tab.id)}
                    onKeyDown={(event) => moveTab(event, workTabs.map((item) => item.id), activeWorkTab, setActiveWorkTab)}
                    className={`min-h-12 shrink-0 cursor-pointer border-b-2 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 ${activeWorkTab === tab.id ? "border-teal-600 text-teal-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                  >{tab.label}</button>
                ))}
              </div>
              <div id={`client-work-panel-${activeWorkTab}`} role="tabpanel" aria-labelledby={`client-work-tab-${activeWorkTab}`} className="min-w-0">
                {activeWorkTab === "tasks" && renderWorkTable(tasks)}
                {activeWorkTab === "checklists" && (
                  checklists.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Checklist", "Owner", "Period", "Items", "Completed", "Overdue", "Status", ""].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">{checklists.map((checklist) => <tr key={`${checklist.organisationId}:${checklist.id}`} className="cursor-default align-top">
                        <td className="px-3 py-3 font-semibold">{checklist.name}</td><td className="px-3 py-3">{checklist.owner}</td><td className="whitespace-nowrap px-3 py-3">{checklist.startDate} – {checklist.endDate}</td><td className="px-3 py-3">{checklist.items.length}</td><td className="px-3 py-3">{checklist.completedCount}</td><td className="px-3 py-3">{checklist.overdueCount}</td><td className="px-3 py-3"><StatusBadge>{checklist.status}</StatusBadge></td>
                        <td className="px-3 py-3"><button type="button" aria-expanded={expandedChecklistId === checklist.id} onClick={() => setExpandedChecklistId(expandedChecklistId === checklist.id ? "" : checklist.id)} className="cursor-pointer font-semibold text-teal-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">{expandedChecklistId === checklist.id ? "Hide Items" : "View Items"}</button></td>
                      </tr>)}</tbody>
                    </table>
                    {checklists.filter((checklist) => checklist.id === expandedChecklistId).map((checklist) => <div key={`items:${checklist.id}`} className="border-t border-slate-200 p-4">
                      <h3 className="font-semibold">{checklist.name} items</h3>
                      {checklist.items.length ? <ul className="mt-3 space-y-2">{checklist.items.map((item) => <li key={`${item.organisationId}:${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3"><span className="font-medium">{item.task}</span><span className="text-sm text-slate-600">{item.targetDate || "No target date"} · {item.responsiblePersonName || "Unassigned"} · {item.status}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No checklist items are available.</p>}
                    </div>)}
                  </div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No checklists are available for this organisation.</p>
                )}
                {activeWorkTab === "recurring" && (
                  recurring.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Schedule", "Owner", "Repeats", "Due Time", "Last Run", "Next Run", "Priority", "Status", "Job Health"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">{recurring.map((schedule: ConsultantRecurringSchedule) => <tr key={`${schedule.task.organisationId}:${schedule.task.id}`} className="cursor-default align-top">
                        <td className="px-3 py-3 font-semibold"><Link href={`/recurring-tasks/${encodeURIComponent(schedule.task.id)}`} className="cursor-pointer text-teal-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">{schedule.task.name}</Link></td>
                        <td className="px-3 py-3">{schedule.owner}</td><td className="px-3 py-3">{schedule.repeats}</td><td className="px-3 py-3">{schedule.task.dueTime || "—"}</td><td className="whitespace-nowrap px-3 py-3">{schedule.lastRun || "—"}</td><td className="whitespace-nowrap px-3 py-3">{schedule.nextRun || "—"}</td><td className="px-3 py-3">{schedule.task.priority}</td><td className="px-3 py-3"><StatusBadge>{schedule.task.status}</StatusBadge></td><td className="px-3 py-3"><StatusBadge>{schedule.jobHealth}</StatusBadge></td>
                      </tr>)}</tbody>
                    </table>
                  </div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No recurring schedules are available for this organisation.</p>
                )}
                {activeWorkTab === "completed" && (
                  completed.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Work", "Type", "Responsible", "Due", "Completed", "Completion Evidence"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">{completed.map((item) => <tr key={`${item.organisationId}:${item.id}`} className="cursor-default align-top"><td className="px-3 py-3 font-semibold">{item.task}</td><td className="px-3 py-3">{item.source}</td><td className="px-3 py-3">{item.responsible}</td><td className="px-3 py-3">{item.dueDate || "—"}</td><td className="px-3 py-3">{item.completedDate || "—"}</td><td className="max-w-md px-3 py-3">{item.completionEvidence || "—"}</td></tr>)}</tbody>
                    </table>
                  </div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No completed work is available for this organisation.</p>
                )}
                {activeWorkTab === "exceptions" && (
                  exceptions.length ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[1000px] border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Severity", "Issue", "Related Item", "Responsible", "Date", "Next Action", "Status"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                      <tbody className="divide-y divide-slate-100">{exceptions.map((exception) => <tr key={`${exception.organisationId}:${exception.id}`} className="cursor-default align-top"><td className="px-3 py-3"><SeverityBadge severity={exception.severity} /></td><td className="px-3 py-3 font-medium">{exception.issue}</td><td className="px-3 py-3">{exception.related}</td><td className="px-3 py-3">{exception.responsible}</td><td className="px-3 py-3">{exception.date || "—"}</td><td className="px-3 py-3">{exception.nextAction || "—"}</td><td className="px-3 py-3"><StatusBadge>{exception.status}</StatusBadge></td></tr>)}</tbody>
                    </table>
                  </div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">No operational exceptions require attention.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-4">
              <section aria-label="Client calendar controls" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={goToToday} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Today</button>
                  <button type="button" aria-label={`Previous ${calendarView === "week" ? "week" : "month"}`} onClick={() => navigateCalendarPeriod(-1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Previous</button>
                  <button type="button" aria-label={`Next ${calendarView === "week" ? "week" : "month"}`} onClick={() => navigateCalendarPeriod(1)} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600">Next</button>
                  <h2 className="min-w-40 flex-1 text-center text-lg font-bold text-slate-950 sm:text-left">{calendarHeading}</h2>
                  {(["month", "week", "agenda"] as const).map((view) => <button key={view} type="button" aria-pressed={calendarView === view} onClick={() => setCalendarView(view)} className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${calendarView === view ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{view}</button>)}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="text-sm font-medium text-slate-700">Activity type<select value={calendarType} onChange={(event) => setCalendarType(event.target.value as ClientActivityTypeFilter)} className={`mt-1 w-full ${calendarSelectClass}`}><option value="all">All activity</option><option value="records">Records</option><option value="tasks">Tasks</option><option value="checklist">Checklist</option><option value="follow_ups">Follow-ups</option></select></label>
                  <label className="text-sm font-medium text-slate-700">Status<select value={calendarStatus} onChange={(event) => setCalendarStatus(event.target.value as ClientActivityStatusFilter)} className={`mt-1 w-full ${calendarSelectClass}`}><option value="all">All statuses</option><option value="due">Due</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="awaiting">Awaiting</option><option value="paused">Paused</option></select></label>
                  <label className="text-sm font-medium text-slate-700">Responsible person<select value={calendarPerson} onChange={(event) => setCalendarPerson(event.target.value)} className={`mt-1 w-full ${calendarSelectClass}`}><option value="all">All responsible people</option>{people.map((person) => <option key={person} value={person}>{person}</option>)}</select></label>
                  <label className="text-sm font-medium text-slate-700">Priority<select value={calendarPriority} onChange={(event) => setCalendarPriority(event.target.value as typeof calendarPriority)} className={`mt-1 w-full ${calendarSelectClass}`}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
                </div>
              </section>
              {visibleCalendarActivityCount === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-600">No calendar activity matches this period and filter.</p>}
              {calendarView === "month" && <CalendarMonthView days={calendarDays} month={calendarMonth} today={today} selectedDate={selectedDate} activities={monthActivities} onSelectDate={selectCalendarDate} />}
              {calendarView === "week" && <CalendarWeekView days={calendarWeekDays} today={today} activities={weekActivities} />}
              {calendarView === "agenda" && <CalendarAgendaView month={calendarMonth} today={today} activities={monthActivities} />}
              {dayPanelOpen && <CalendarDayPanel date={selectedDate} activities={selectedActivities} today={today} onClose={() => setDayPanelOpen(false)} />}
            </div>
          )}

          {activeTab === "notifications" && (
            <section aria-label="Client communication history" className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {relatedCommunications.length ? <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Subject", "Type", "Related Item", "Recipient", "Decision / Review Status", "Delivery Status", "Date", "Next Follow-up"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{relatedCommunications.map((communication) => {
                  const relatedRecord = records.find((record) => record.id === communication.recordId);
                  const relatedTask = allTasks.find((task) => task.id === communication.relatedTaskId && task.organisationId === id);
                  return <tr key={communication.id} className="cursor-default align-top"><td className="max-w-xs px-3 py-3 font-semibold">{communication.subject || "—"}</td><td className="px-3 py-3">{communication.type}</td><td className="px-3 py-3">{relatedRecord?.name || relatedTask?.name || "—"}</td><td className="px-3 py-3">{communication.recipient || "—"}</td><td className="px-3 py-3"><StatusBadge>{communicationDecision(communication)}</StatusBadge></td><td className="px-3 py-3"><StatusBadge>{communication.deliveryStatus}</StatusBadge></td><td className="whitespace-nowrap px-3 py-3">{communication.date || "—"}</td><td className="whitespace-nowrap px-3 py-3">{communication.nextFollowUp || "—"}</td></tr>;
                })}</tbody>
              </table> : <p className="p-8 text-center text-slate-600">No notification history is available for this organisation.</p>}
            </section>
          )}

          {activeTab === "activity" && (
            <section aria-label="Client material activity" className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              {materialActivity.length ? <table className="w-full min-w-[950px] border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{["Date / Time", "Actor", "Action", "Entity Type", "Entity", "Context"].map((heading) => <th key={heading} scope="col" className="px-3 py-3">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{materialActivity.map((event) => {
                  const rawContext = event.context?.trim() || "";
                  const safeContext = [
                    "Client-submitted metadata only; no underlying document was uploaded or stored.",
                    "Client-submitted metadata update.",
                    "Calendar follow-up scheduled using the existing monitored-record follow-up fields.",
                    "Created from the Client Calendar using the existing canonical workspace entity.",
                    "Client workspace tracker metadata.",
                  ].includes(rawContext) || /^Tracker: [^;]+$/.test(rawContext);
                  const context = safeContext ? rawContext : rawContext ? "Additional details omitted" : "—";
                  return <tr key={event.id} className="cursor-default align-top"><td className="whitespace-nowrap px-3 py-3"><time dateTime={event.timestamp || event.date}>{formatAuditDate(event.timestamp || event.date)}</time></td><td className="px-3 py-3">{event.user || "—"}</td><td className="px-3 py-3 font-medium">{event.action}</td><td className="px-3 py-3">{event.entityType || (event.recordId ? "record" : "—")}</td><td className="px-3 py-3">{event.entityName || event.recordName || "—"}</td><td className="max-w-sm px-3 py-3">{context}</td></tr>;
                })}</tbody>
              </table> : <p className="p-8 text-center text-slate-600">No material activity is available for this organisation.</p>}
            </section>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
