"use client";

import { useEffect, useState } from "react";
import {
  ClientNotification,
  ClientRecord,
  ClientTask,
  ClientTaskOccurrence,
  ClientWorkspaceOrganisation,
  ensureClientWorkspaceDemoData,
  getClientWorkspaceNotifications,
  getClientWorkspaceOccurrences,
  getClientWorkspaceOrganisation,
  getClientWorkspaceTasks,
} from "@/lib/clientWorkspace";
import { setAuthenticatedClientOrganisation } from "@/lib/clientWorkspaceConstants";
import { resolvePrototypeClientForOrganisation } from "@/lib/clientStore";
import { getAuditEvents, AuditEvent } from "@/lib/recordStore";
import { ClientWorkspaceState, getClientWorkspaceState } from "@/lib/clientWorkspaceStore";

export const CLIENT_ASSIGNED_TASKS_UPDATED_EVENT = "deadline-monitor-client-tasks-updated";

export type ClientAssignedTask = {
  id: string;
  organisation_id: string;
  created_by: string;
  assigned_to: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "low" | "medium" | "high";
  status: string;
  response_note: string | null;
  updated_at: string;
};

export type ClientWorkspaceMemberRole = "client_administrator" | "client_user";

export type ClientWorkspaceData = {
  ready: boolean;
  error?: string;
  assignedTasksError?: string;
  assignedTasksReady: boolean;
  authOrganisationId: string;
  userId: string;
  isSeniorManager: boolean;
  organisation?: ClientWorkspaceOrganisation;
  team: Array<{ id: string; name: string; jobTitle: string; role: ClientWorkspaceMemberRole }>;
  records: ClientRecord[];
  tasks: ClientTask[];
  assignedTasks: ClientAssignedTask[];
  occurrences: ClientTaskOccurrence[];
  notifications: ClientNotification[];
  auditEvents: AuditEvent[];
  workspaceState: ClientWorkspaceState;
};

const emptyData: ClientWorkspaceData = {
  ready: false,
  assignedTasksReady: false,
  authOrganisationId: "",
  userId: "",
  isSeniorManager: false,
  team: [],
  records: [],
  tasks: [],
  assignedTasks: [],
  occurrences: [],
  notifications: [],
  auditEvents: [],
  workspaceState: { organisationId: "", people: [], trackers: [], items: [], reminderPreference: { delivery: "In-app only", summaryFrequency: "Weekly on Monday", time: "09:00", dailySummary: "morning", monthlyRule: "last-working-day", categories: [], timeZone: "Africa/Johannesburg" } },
};

export default function useClientWorkspaceData() {
  const [data, setData] = useState<ClientWorkspaceData>(emptyData);

  useEffect(() => {
    let active = true;
    function loadLocalData() {
      setData((current) => ({
        ...current,
        organisation: getClientWorkspaceOrganisation() || current.organisation,
        tasks: getClientWorkspaceTasks(),
        occurrences: getClientWorkspaceOccurrences(),
        notifications: getClientWorkspaceNotifications(),
        auditEvents: getAuditEvents(),
        workspaceState: getClientWorkspaceState(),
      }));
    }

    async function loadWorkspace() {
      try {
        const response = await fetch("/api/client/workspace", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || result.status !== "authorized") {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "The company workspace could not be loaded.",
          );
        }
        const organisation = result.organisation;
        const user = result.user;
        if (
          !isRecord(organisation) ||
          typeof organisation.id !== "string" ||
          typeof organisation.name !== "string" ||
          (organisation.role !== "client_administrator" &&
            organisation.role !== "client_user") ||
          typeof organisation.isSeniorManager !== "boolean" ||
          typeof organisation.jobTitle !== "string" ||
          !isRecord(user) ||
          typeof user.id !== "string" ||
          typeof user.name !== "string" ||
          typeof user.email !== "string"
        ) {
          throw new Error("The company workspace returned invalid account details.");
        }
        const context = {
          id: organisation.id,
          name: organisation.name,
          role: organisation.role,
          isPrimary: organisation.isSeniorManager,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
        } as const;
        const prototype = resolvePrototypeClientForOrganisation(
          context.id,
          context.name,
        );
        if (!active) return;
        setAuthenticatedClientOrganisation(context, prototype?.id);
        ensureClientWorkspaceDemoData();
        const team = Array.isArray(result.team)
          ? result.team.flatMap((member) => {
              if (
                !isRecord(member) ||
                typeof member.id !== "string" ||
                typeof member.name !== "string" ||
                typeof member.jobTitle !== "string" ||
                !isClientWorkspaceMemberRole(member.role)
              ) {
                return [];
              }
              return [{
                id: member.id,
                name: member.name,
                jobTitle: member.jobTitle,
                role: member.role,
              }];
            })
          : [];
        setData({
          ...emptyData,
          ready: true,
          authOrganisationId: context.id,
          userId: user.id,
          isSeniorManager: organisation.isSeniorManager,
          organisation: getClientWorkspaceOrganisation(),
          records: parseRecords(result.records, context.id),
          team,
          tasks: getClientWorkspaceTasks(),
          occurrences: getClientWorkspaceOccurrences(),
          notifications: getClientWorkspaceNotifications(),
          auditEvents: getAuditEvents(),
          workspaceState: getClientWorkspaceState(),
        });
      } catch (error) {
        if (!active) return;
        setData({
          ...emptyData,
          ready: true,
          error: error instanceof Error ? error.message : "The company workspace could not be loaded.",
        });
      }
    }

    void loadWorkspace();
    window.addEventListener("deadline-monitor-updated", loadLocalData);
    return () => {
      active = false;
      window.removeEventListener("deadline-monitor-updated", loadLocalData);
    };
  }, []);

  useEffect(() => {
    const organisationId = data.authOrganisationId;
    const userId = data.userId;
    if (!data.ready || !organisationId || !userId) return;

    let active = true;
    let latestRequest = 0;
    async function loadAssignedTasks() {
      const requestNumber = ++latestRequest;
      try {
        const response = await fetch("/api/client/tasks", { cache: "no-store" });
        const result: unknown = await response.json();
        if (!response.ok || !isRecord(result) || !Array.isArray(result.tasks)) {
          throw new Error(
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "Company tasks could not be loaded.",
          );
        }
        const rawTasks: unknown[] = result.tasks;
        if (!rawTasks.every(isClientAssignedTask)) {
          throw new Error("The company task list returned invalid data. Refresh and try again.");
        }
        const assignedTasks = rawTasks
          .filter(isClientAssignedTask)
          .filter((task) =>
            task.organisation_id === organisationId &&
            (task.created_by === userId || task.assigned_to === userId)
          );
        if (active && requestNumber === latestRequest) {
          setData((current) => ({
            ...current,
            assignedTasks,
            assignedTasksError: undefined,
            assignedTasksReady: true,
          }));
        }
      } catch (error) {
        if (!active || requestNumber !== latestRequest) return;
        setData((current) => ({
          ...current,
          assignedTasksError: error instanceof Error
            ? error.message
            : "Company tasks could not be loaded.",
          assignedTasksReady: true,
        }));
      }
    }

    const refreshAssignedTasks = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      const updatedTasks = (Array.isArray(detail) ? detail : [detail])
        .filter(isClientAssignedTask)
        .filter((task) =>
          task.organisation_id === organisationId &&
          (task.created_by === userId || task.assigned_to === userId)
        );
      if (updatedTasks.length > 0) {
        setData((current) => ({
          ...current,
          assignedTasks: [
            ...updatedTasks,
            ...current.assignedTasks.filter((currentTask) =>
              !updatedTasks.some((task) => task.id === currentTask.id)
            ),
          ],
          assignedTasksError: undefined,
          assignedTasksReady: true,
        }));
      }
      void loadAssignedTasks();
    };
    void loadAssignedTasks();
    window.addEventListener(CLIENT_ASSIGNED_TASKS_UPDATED_EVENT, refreshAssignedTasks);
    return () => {
      active = false;
      window.removeEventListener(CLIENT_ASSIGNED_TASKS_UPDATED_EVENT, refreshAssignedTasks);
    };
  }, [data.ready, data.authOrganisationId, data.userId]);

  return data;
}

export function isClientAssignedTask(value: unknown): value is ClientAssignedTask {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.organisation_id === "string" &&
    typeof value.created_by === "string" &&
    typeof value.assigned_to === "string" &&
    typeof value.title === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.due_date === "string" || value.due_date === null) &&
    (value.priority === "low" || value.priority === "medium" || value.priority === "high") &&
    typeof value.status === "string" &&
    (typeof value.response_note === "string" || value.response_note === null) &&
    typeof value.updated_at === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClientWorkspaceMemberRole(value: unknown): value is ClientWorkspaceMemberRole {
  return value === "client_administrator" || value === "client_user";
}

function parseRecords(value: unknown, organisationId: string): ClientRecord[] {
  if (!Array.isArray(value)) return [];
  const categories = new Set([
    "COIDA", "SARS", "Vehicles", "Company Documents", "CIPC", "Insurance",
    "Employees", "Contracts", "Property", "Professional Registrations",
    "Health and Safety", "Municipal", "Other",
  ]);
  const statuses = new Set([
    "Current", "Due soon", "Expired", "Awaiting client",
    "Awaiting confirmation", "Completed", "Paused",
  ]);
  const risks = new Set(["Low", "Medium", "High"]);
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.category !== "string" ||
      !categories.has(item.category) ||
      typeof item.status !== "string" ||
      !statuses.has(item.status) ||
      typeof item.risk !== "string" ||
      !risks.has(item.risk)
    ) {
      return [];
    }
    const stringField = (field: string) =>
      typeof item[field] === "string" ? item[field] as string : "";
    return [{
      id: item.id,
      name: item.name,
      organisationId: stringField("organisationId") || organisationId,
      organisation: stringField("organisation"),
      category: item.category as ClientRecord["category"],
      category2: stringField("category2"),
      issueDate: stringField("issueDate"),
      expiryDate: stringField("expiryDate"),
      status: item.status as ClientRecord["status"],
      risk: item.risk as ClientRecord["risk"],
      contact: stringField("contact"),
      followUp: stringField("followUp"),
      lastConfirmed: stringField("lastConfirmed"),
      referenceNumber: stringField("referenceNumber"),
      nextAction: stringField("nextAction"),
      notes: stringField("notes"),
      reminderFrequency: item.reminderFrequency === "daily" ||
        item.reminderFrequency === "weekly" ||
        item.reminderFrequency === "monthly" ||
        item.reminderFrequency === "custom"
        ? item.reminderFrequency
        : undefined,
      reminderLeadDays: typeof item.reminderLeadDays === "number"
        ? item.reminderLeadDays
        : undefined,
      clientCreated: false,
    }];
  });
}
