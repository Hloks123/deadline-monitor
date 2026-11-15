import type { LegacyContactRow } from "./validation";

export type CanonicalContactMatch = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type RecordedContactMapping = {
  legacy_id: string;
  target_id: string | null;
  status: string;
  target_table: string;
};

export type ContactMappingPlan = {
  legacyId: string;
  targetId: string | null;
  method:
    | "existing_mapping"
    | "email"
    | "phone"
    | "name"
    | "create"
    | "ambiguous"
    | "unresolved";
  warning?: string;
};

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function normalizedEmail(value: string | null) {
  return (value || "").trim().toLocaleLowerCase("en-US");
}

function normalizedPhone(value: string | null) {
  return (value || "").replace(/[^0-9+]/g, "");
}

export function planLegacyContactMappings(
  contacts: LegacyContactRow[],
  canonicalContacts: CanonicalContactMatch[],
  recordedMappings: RecordedContactMapping[],
): ContactMappingPlan[] {
  return contacts.map((legacy) => {
    const recorded = recordedMappings.filter(
      (mapping) =>
        mapping.legacy_id === legacy.legacy_id &&
        mapping.status === "imported" &&
        mapping.target_table === "organisation_contacts" &&
        mapping.target_id,
    );
    const recordedIds = new Set(recorded.map((mapping) => mapping.target_id));
    if (recordedIds.size === 1) {
      const targetId = [...recordedIds][0]!;
      if (canonicalContacts.some((contact) => contact.id === targetId)) {
        return { legacyId: legacy.legacy_id, targetId, method: "existing_mapping" };
      }
    } else if (recordedIds.size > 1) {
      return {
        legacyId: legacy.legacy_id,
        targetId: null,
        method: "ambiguous",
        warning: "Previous migration runs map this contact to different canonical contacts.",
      };
    }

    const email = normalizedEmail(legacy.email);
    if (email) {
      const matches = canonicalContacts.filter(
        (contact) => normalizedEmail(contact.email) === email,
      );
      if (matches.length === 1) {
        return { legacyId: legacy.legacy_id, targetId: matches[0].id, method: "email" };
      }
      if (matches.length > 1) {
        return {
          legacyId: legacy.legacy_id,
          targetId: null,
          method: "ambiguous",
          warning: "More than one contact in this organisation has the same normalized email.",
        };
      }
    }

    const phone = normalizedPhone(legacy.phone);
    if (phone) {
      const matches = canonicalContacts.filter(
        (contact) => normalizedPhone(contact.phone) === phone,
      );
      if (matches.length === 1) {
        return { legacyId: legacy.legacy_id, targetId: matches[0].id, method: "phone" };
      }
      if (matches.length > 1) {
        return {
          legacyId: legacy.legacy_id,
          targetId: null,
          method: "ambiguous",
          warning: "More than one contact in this organisation has the same normalized phone number.",
        };
      }
    }

    const name = normalizedName(legacy.name);
    const matches = canonicalContacts.filter(
      (contact) => normalizedName(contact.name) === name,
    );
    if (matches.length === 1) {
      return { legacyId: legacy.legacy_id, targetId: matches[0].id, method: "name" };
    }
    if (matches.length > 1) {
      return {
        legacyId: legacy.legacy_id,
        targetId: null,
        method: "ambiguous",
        warning: "More than one contact in this organisation has the same normalized name.",
      };
    }

    return {
      legacyId: legacy.legacy_id,
      targetId: null,
      method: legacy.name.trim() ? "create" : "unresolved",
      warning: legacy.name.trim()
        ? undefined
        : "A contact without a display name cannot be created or matched.",
    };
  });
}
