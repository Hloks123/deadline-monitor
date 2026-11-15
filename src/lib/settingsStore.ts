export type PackageName =
  | "Starter"
  | "Standard"
  | "Managed"
  | "Custom";

export type ClientPackage = {
  id: string;
  name: PackageName;
  setupFee: number;
  monthlyFee: number;
  recordLimit: number;
  userLimit: number;
  active: boolean;
  features: string[];
};

export type CategoryConfig = {
  id: string;
  name: string;
  active: boolean;

  children: {
    id: string;
    name: string;
    active: boolean;
  }[];
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  message: string;
  active: boolean;
};

export type SettingsData = {
  packagePricingVersion: number;
  businessName: string;
  timeZone: string;
  supportEmail: string;

  senderName: string;
  senderEmail: string;
  senderDomainVerified: boolean;

  reminderDays: number[];
  dailyReview: boolean;
  reviewRequired: boolean;

  highRiskExpiredLevel: string;
  expiredLevel: string;
  overdueFollowUpLevel: string;
  dueSoonLevel: string;

  retentionMonths: number;

  backupAdministrator: string;
  supportContact: string;
  outageContact: string;
  escalationContact: string;

  templates: EmailTemplate[];
  packages: ClientPackage[];
  categories: CategoryConfig[];
};

export const SETTINGS_KEY =
  "doc-monitor-settings-v2";

export const defaultTemplates: EmailTemplate[] =
  [
    {
      id: "standard-reminder",
      name: "Standard Reminder",

      subject:
        "Reminder: {{document}} expires on {{expiryDate}}",

      message: `Dear {{contact}},

This is a reminder that {{document}} for {{organisation}} requires attention.

Category: {{category1}} · {{category2}}
Current expiry date: {{expiryDate}}
Days remaining: {{daysRemaining}}
Risk: {{risk}}

Please confirm the replacement or updated expiry date.

Regards,
Deadline-Monitor`,

      active: true,
    },

    {
      id: "urgent-reminder",
      name: "Urgent Reminder",

      subject:
        "Urgent: {{document}} requires immediate attention",

      message: `Dear {{contact}},

URGENT: {{document}} for {{organisation}} requires immediate attention.

Current expiry date: {{expiryDate}}
Days remaining: {{daysRemaining}}
Risk: {{risk}}

Please confirm the current position as soon as possible.

Regards,
Deadline-Monitor`,

      active: true,
    },

    {
      id: "overdue-reminder",
      name: "Overdue Reminder",

      subject:
        "Overdue: {{document}} for {{organisation}}",

      message: `Dear {{contact}},

Our monitoring register shows that {{document}} for {{organisation}} is overdue.

Previous expiry date: {{expiryDate}}
Risk: {{risk}}
Next follow-up: {{followUpDate}}

Please confirm whether the record has been renewed and provide the new expiry date.

Regards,
Deadline-Monitor`,

      active: true,
    },

    {
      id: "client-follow-up",
      name: "Client Follow-up",

      subject:
        "Follow-up: {{document}} for {{organisation}}",

      message: `Dear {{contact}},

We are following up regarding {{document}} for {{organisation}}.

Please confirm the current status and provide the replacement expiry date where applicable.

Next scheduled follow-up: {{followUpDate}}

Regards,
Deadline-Monitor`,

      active: true,
    },
  ];

export const defaultPackages: ClientPackage[] =
  [
    {
      id: "starter",

      name:
        "Starter",

      setupFee:
        500,

      monthlyFee:
        399,

      recordLimit:
        25,

      userLimit:
        1,

      active:
        true,

      features: [
        "Dashboard",
        "Monthly reminder review",
        "Monthly monitoring report",
      ],
    },

    {
      id: "standard",

      name:
        "Standard",

      setupFee:
        1000,

      monthlyFee:
        799,

      recordLimit:
        75,

      userLimit:
        4,

      active:
        true,

      features: [
        "Reviewed reminder emails",
        "Monthly monitoring report",
        "Authorised client users",
      ],
    },

    {
      id: "managed",

      name:
        "Managed",

      setupFee:
        2000,

      monthlyFee:
        1499,

      recordLimit:
        150,

      userLimit:
        12,

      active:
        true,

      features: [
        "Active consultant follow-up",
        "Monthly monitoring report",
        "Quarterly monitoring review",
      ],
    },

    {
      id: "custom",

      name:
        "Custom",

      setupFee:
        0,

      monthlyFee:
        2500,

      recordLimit:
        500,

      userLimit:
        20,

      active:
        true,

      features: [
        "Multiple branches",
        "Custom categories",
        "Custom reporting",
        "Integration planning",
      ],
    },
  ];

export const defaultCategories: CategoryConfig[] =
  [
    {
      id:
        "coida",

      name:
        "COIDA",

      active:
        true,

      children: [
        {
          id:
            "letter-of-good-standing",

          name:
            "Letter of Good Standing",

          active:
            true,
        },

        {
          id:
            "registration-certificate",

          name:
            "Registration Certificate",

          active:
            true,
        },

        {
          id:
            "return-of-earnings",

          name:
            "Return of Earnings",

          active:
            true,
        },
      ],
    },

    {
      id:
        "sars",

      name:
        "SARS",

      active:
        true,

      children: [
        {
          id:
            "tax-compliance-status",

          name:
            "Tax Compliance Status",

          active:
            true,
        },

        {
          id:
            "vat-registration",

          name:
            "VAT Registration",

          active:
            true,
        },

        {
          id:
            "paye-registration",

          name:
            "PAYE Registration",

          active:
            true,
        },

        {
          id:
            "emp201",

          name:
            "EMP201",

          active:
            true,
        },

        {
          id:
            "emp501",

          name:
            "EMP501",

          active:
            true,
        },
      ],
    },

    {
      id:
        "vehicles",

      name:
        "Vehicles",

      active:
        true,

      children: [
        {
          id:
            "vehicle-licence",

          name:
            "Vehicle Licence",

          active:
            true,
        },

        {
          id:
            "roadworthy-certificate",

          name:
            "Roadworthy Certificate",

          active:
            true,
        },

        {
          id:
            "operating-permit",

          name:
            "Operating Permit",

          active:
            true,
        },

        {
          id:
            "vehicle-insurance",

          name:
            "Vehicle Insurance",

          active:
            true,
        },
      ],
    },

    {
      id:
        "company-documents",

      name:
        "Company Documents",

      active:
        true,

      children: [
        {
          id:
            "bbbee-affidavit",

          name:
            "B-BBEE Affidavit",

          active:
            true,
        },

        {
          id:
            "bbbee-certificate",

          name:
            "B-BBEE Certificate",

          active:
            true,
        },

        {
          id:
            "company-registration",

          name:
            "Company Registration Certificate",

          active:
            true,
        },

        {
          id:
            "memorandum-of-incorporation",

          name:
            "Memorandum of Incorporation",

          active:
            true,
        },

        {
          id:
            "share-certificate",

          name:
            "Share Certificate",

          active:
            true,
        },

        {
          id:
            "beneficial-ownership",

          name:
            "Beneficial Ownership Declaration",

          active:
            true,
        },
      ],
    },
  ];

export const CURRENT_PACKAGE_PRICING_VERSION = 4;

const approvedPackageTerms: Partial<
  Record<
    PackageName,
    Pick<ClientPackage, "setupFee" | "userLimit">
  >
> = {
  Starter: { setupFee: 500, userLimit: 1 },
  Standard: { setupFee: 1000, userLimit: 4 },
  Managed: { setupFee: 2000, userLimit: 12 },
};

function applyApprovedPackageTerms(
  packages: ClientPackage[],
): ClientPackage[] {
  return packages.map((clientPackage) => {
    const terms = approvedPackageTerms[clientPackage.name];
    return terms ? { ...clientPackage, ...terms } : clientPackage;
  });
}

export const defaultSettings: SettingsData =
  {
    packagePricingVersion:
      CURRENT_PACKAGE_PRICING_VERSION,
    businessName:
      "Deadline-Monitor",

    timeZone:
      "Africa/Johannesburg",

    supportEmail:
      "support@docmonitor.co.za",

    senderName:
      "Deadline-Monitor",

    senderEmail:
      "reminders@docmonitor.co.za",

    senderDomainVerified:
      false,

    reminderDays: [
      60,
      30,
      14,
      7,
      0,
    ],

    dailyReview:
      true,

    reviewRequired:
      true,

    highRiskExpiredLevel:
      "Critical",

    expiredLevel:
      "Escalated",

    overdueFollowUpLevel:
      "Escalated",

    dueSoonLevel:
      "Follow-up required",

    retentionMonths:
      24,

    backupAdministrator:
      "backup@docmonitor.co.za",

    supportContact:
      "support@docmonitor.co.za",

    outageContact:
      "support@docmonitor.co.za",

    escalationContact:
      "consultant@docmonitor.co.za",

    templates:
      defaultTemplates,

    packages:
      defaultPackages,

    categories:
      defaultCategories,
  };

export function getSettings(): SettingsData {
  if (
    typeof window ===
    "undefined"
  ) {
    return defaultSettings;
  }

  const stored =
    localStorage.getItem(
      SETTINGS_KEY
    );

  if (!stored) {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        defaultSettings
      )
    );

    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<SettingsData> & {
      users?: unknown;
    };
    const { users: legacyUsers, ...persistedSettings } = parsed;
    const needsPackagePricingUpdate =
      parsed.packagePricingVersion !==
      CURRENT_PACKAGE_PRICING_VERSION;

    const retentionMonths =
      Number(
        parsed.retentionMonths ??
          defaultSettings.retentionMonths
      );

    const settings: SettingsData = {
      ...defaultSettings,

      ...persistedSettings,

      packagePricingVersion:
        CURRENT_PACKAGE_PRICING_VERSION,

      retentionMonths:
        Number.isFinite(
          retentionMonths
        )
          ? Math.min(
              120,
              Math.max(
                1,
                retentionMonths
              )
            )
          : 24,

      templates:
        parsed.templates ||
        defaultTemplates,

      packages:
        needsPackagePricingUpdate
          ? applyApprovedPackageTerms(
              parsed.packages || defaultPackages,
            )
          : parsed.packages || defaultPackages,

      categories:
        parsed.categories ||
        defaultCategories,
    };
    if (
      legacyUsers !== undefined ||
      needsPackagePricingUpdate
    ) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    return settings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(
  settings: SettingsData
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  try {
    const retentionMonths =
      Math.min(
        120,
        Math.max(
          1,
          Math.round(
            settings.retentionMonths
          )
        )
      );

    const settingsToSave: SettingsData =
      {
        ...settings,

        retentionMonths,
      };

    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        settingsToSave
      )
    );

    window.dispatchEvent(
      new Event(
        "deadline-monitor-settings-updated"
      )
    );

    return true;
  } catch {
    return false;
  }
}

export function resetSettings() {
  if (
    typeof window !==
    "undefined"
  ) {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify(
        defaultSettings
      )
    );

    window.dispatchEvent(
      new Event(
        "deadline-monitor-settings-updated"
      )
    );
  }

  return defaultSettings;
}

export function createSettingId(
  value: string
) {
  const id = value
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );

  if (id) {
    return id;
  }

  return crypto.randomUUID();
}