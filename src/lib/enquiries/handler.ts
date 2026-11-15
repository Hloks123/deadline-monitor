export type EnquiryEmail = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

export type EnquiryEnvironment = {
  RESEND_API_KEY?: string;
  ENQUIRY_TO_EMAIL?: string;
  ENQUIRY_FROM_EMAIL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
};

type Enquiry = {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  industry: string;
  recordCount: string;
  contactMethod: string;
  message: string;
};

const industries: Record<string, string> = {
  construction: "Construction",
  transport: "Transport & Fleet",
  property: "Property & Real Estate",
  "professional-services": "Professional Services",
  manufacturing: "Manufacturing",
  retail: "Retail",
  wholesale: "Wholesale & Distribution",
  hospitality: "Hospitality & Tourism",
  agriculture: "Agriculture & Farming",
  mining: "Mining & Resources",
  engineering: "Engineering",
  security: "Security Services",
  cleaning: "Cleaning & Facilities Management",
  healthcare: "Healthcare & Medical Services",
  education: "Education & Training",
  "financial-services": "Financial & Accounting Services",
  "information-technology": "Information Technology",
  telecommunications: "Telecommunications",
  automotive: "Automotive",
  logistics: "Logistics & Warehousing",
  other: "Other",
};

const packages: Record<string, string> = {
  "1-25": "Starter",
  "26-75": "Standard",
  "76-150": "Managed",
  "150+": "Custom",
  "not-sure": "Assistance requested",
};

const allowedFields = new Set([
  "contactName",
  "companyName",
  "email",
  "phone",
  "industry",
  "recordCount",
  "contactMethod",
  "message",
  "privacyConsent",
  "website",
]);

function jsonResponse(status: number, body: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, maximum: number, allowNewlines = false) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const controlCharacters = allowNewlines
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  if (trimmed.length > maximum || controlCharacters.test(trimmed)) return null;
  return trimmed;
}

function isValidEmail(value: string) {
  if (value.length > 254 || value.includes("..")) return false;
  const at = value.lastIndexOf("@");
  if (at < 1 || at !== value.indexOf("@")) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    return false;
  }

  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label),
    )
  );
}

function isValidTelephone(value: string) {
  const digits = value.replace(/\D/g, "");
  return (
    /^\+?[0-9\s().-]+$/.test(value) &&
    digits.length >= 7 &&
    digits.length <= 15
  );
}

function normalizeVercelOrigin(hostname: string | undefined) {
  if (!hostname) return null;
  try {
    const url = new URL(
      hostname.includes("://") ? hostname : `https://${hostname}`,
    );
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function isAllowedOrigin(request: Request, env: EnquiryEnvironment) {
  const allowedOrigins = new Set([
    "https://deadlinemonitor.co.za",
    "https://www.deadlinemonitor.co.za",
    "http://localhost:3000",
    normalizeVercelOrigin(env.VERCEL_PROJECT_PRODUCTION_URL),
    normalizeVercelOrigin(env.VERCEL_URL),
  ]);
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  let origin: string | null = null;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      if (parsed.origin !== originHeader || !allowedOrigins.has(parsed.origin)) {
        return false;
      }
      origin = parsed.origin;
    } catch {
      return false;
    }
  }

  if (refererHeader) {
    try {
      const refererOrigin = new URL(refererHeader).origin;
      if (
        !allowedOrigins.has(refererOrigin) ||
        (origin !== null && refererOrigin !== origin)
      ) {
        return false;
      }
      origin = refererOrigin;
    } catch {
      return false;
    }
  }

  return origin !== null;
}

function parseEnquiry(value: unknown): Enquiry | "spam" | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedFields.has(key))) {
    return null;
  }

  const honeypot = readText(value.website ?? "", 100);
  if (honeypot === null) return null;
  if (honeypot !== "") return "spam";

  const contactName = readText(value.contactName, 120);
  const companyName = readText(value.companyName, 160);
  const email = readText(value.email, 254);
  const phone = readText(value.phone, 30);
  const industry = readText(value.industry, 40);
  const recordCount = readText(value.recordCount, 20);
  const contactMethod = readText(value.contactMethod ?? "email", 20);
  const message = readText(value.message ?? "", 2000, true);

  if (
    !contactName ||
    !companyName ||
    !email ||
    !isValidEmail(email) ||
    !phone ||
    !isValidTelephone(phone) ||
    !industry ||
    !industries[industry] ||
    !recordCount ||
    !packages[recordCount] ||
    !contactMethod ||
    !["email", "phone"].includes(contactMethod) ||
    message === null ||
    value.privacyConsent !== true
  ) {
    return null;
  }

  return {
    contactName,
    companyName,
    email,
    phone,
    industry,
    recordCount,
    contactMethod,
    message,
  };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const escapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escapes[character];
  });
}

function buildEmail(enquiry: Enquiry): Pick<EnquiryEmail, "subject" | "html" | "text"> {
  const submittedAt = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "Africa/Johannesburg",
  }).format(new Date());
  const fields = [
    ["Contact name", enquiry.contactName],
    ["Company", enquiry.companyName],
    ["Business email", enquiry.email],
    ["Telephone", enquiry.phone],
    ["Industry", industries[enquiry.industry]],
    ["Approximate monitored-record count", enquiry.recordCount],
    ["Recommended package", packages[enquiry.recordCount]],
    ["Preferred contact method", enquiry.contactMethod],
    ["Submitted (Africa/Johannesburg)", submittedAt],
  ];
  const message = enquiry.message || "Not supplied";
  const rows = fields
    .map(
      ([label, value]) =>
        `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`,
    )
    .join("");

  return {
    subject: `New Deadline Monitor enquiry - ${enquiry.companyName}`,
    html: `${rows}<p><strong>Message</strong></p><pre style="white-space: pre-wrap; font: inherit">${escapeHtml(message)}</pre>`,
    text: [
      ...fields.map(([label, value]) => `${label}: ${value}`),
      "",
      "Message:",
      message,
    ].join("\n"),
  };
}

export function createEnquiryPostHandler({
  sendEmail,
  env = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ENQUIRY_TO_EMAIL: process.env.ENQUIRY_TO_EMAIL,
    ENQUIRY_FROM_EMAIL: process.env.ENQUIRY_FROM_EMAIL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  },
}: {
  sendEmail: (apiKey: string, email: EnquiryEmail) => Promise<boolean>;
  env?: EnquiryEnvironment;
}) {
  return async function POST(request: Request) {
    try {
      return await processEnquiry(request, sendEmail, env);
    } catch {
      console.error("Unexpected enquiry processing error.");
      return jsonResponse(500, { error: "An unexpected error occurred." });
    }
  };
}

async function processEnquiry(
  request: Request,
  sendEmail: (apiKey: string, email: EnquiryEmail) => Promise<boolean>,
  env: EnquiryEnvironment,
) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return jsonResponse(415, { error: "Send a JSON request." });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    return jsonResponse(400, { error: "Check the form details and try again." });
  }

  if (!isAllowedOrigin(request, env)) {
    return jsonResponse(403, { error: "Request origin is not allowed." });
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Check the form details and try again." });
  }

  const enquiry = parseEnquiry(body);
  if (!enquiry || enquiry === "spam") {
    return jsonResponse(400, { error: "Check the form details and try again." });
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.ENQUIRY_TO_EMAIL?.trim();
  const from = env.ENQUIRY_FROM_EMAIL?.trim();
  const fromDomain = from?.split("@").pop() ?? "";
  if (
    !apiKey ||
    !to ||
    !from ||
    !isValidEmail(to) ||
    !isValidEmail(from) ||
    !/(^|\.)deadlinemonitor\.co\.za$/i.test(fromDomain)
  ) {
    return jsonResponse(503, {
      error: "Enquiry email service is not configured.",
    });
  }

  try {
    const message = buildEmail(enquiry);
    const accepted = await sendEmail(apiKey, {
      to,
      from,
      replyTo: enquiry.email,
      ...message,
    });
    if (!accepted) {
      console.error("Enquiry email delivery was not accepted.");
      return jsonResponse(502, { error: "Could not send your enquiry." });
    }
    return jsonResponse(201, {
      message: "Your enquiry has been sent.",
    });
  } catch {
    console.error("Enquiry email delivery failed.");
    return jsonResponse(502, { error: "Could not send your enquiry." });
  }
}
