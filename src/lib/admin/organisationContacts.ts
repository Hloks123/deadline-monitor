export type OrganisationContactInput = {
  name: string;
  email: string;
  phone: string;
  role_title: string;
  authorised: boolean;
  primary_contact: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOrganisationContacts(
  value: unknown,
): OrganisationContactInput[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    return null;
  }

  const contacts: OrganisationContactInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
    const phone = typeof item.phone === "string" ? item.phone.trim() : "";
    const roleTitle =
      typeof item.roleTitle === "string" ? item.roleTitle.trim() : "";
    if (
      !name ||
      name.length > 120 ||
      email.length > 254 ||
      (email !== "" && !emailPattern.test(email)) ||
      phone.length > 40 ||
      roleTitle.length > 80 ||
      typeof item.authorised !== "boolean" ||
      typeof item.primary !== "boolean" ||
      (item.authorised && !email)
    ) {
      return null;
    }
    contacts.push({
      name,
      email,
      phone,
      role_title: roleTitle,
      authorised: item.authorised,
      primary_contact: item.primary,
    });
  }

  const authorised = contacts.filter((contact) => contact.authorised);
  if (
    authorised.length === 0 ||
    authorised.filter((contact) => contact.primary_contact).length !== 1
  ) {
    return null;
  }
  return contacts;
}
