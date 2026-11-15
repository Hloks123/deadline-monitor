/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  module._compile(output, filename);
};

const { createEnquiryPostHandler, escapeHtml } = require("./handler.ts");
const config = {
  RESEND_API_KEY: "test-secret-key",
  ENQUIRY_TO_EMAIL: "consultant1@compimento.co.za",
  ENQUIRY_FROM_EMAIL: "enquiries@deadlinemonitor.co.za",
  VERCEL_PROJECT_PRODUCTION_URL: "deadline-monitor.vercel.app",
};

function validBody(overrides = {}) {
  return {
    contactName: "Ada Consultant",
    companyName: "Example Company",
    email: "ada@example.co.za",
    phone: "+27 73 501 9603",
    industry: "professional-services",
    recordCount: "26-75",
    contactMethod: "email",
    message: "Please contact me.",
    privacyConsent: true,
    website: "",
    ...overrides,
  };
}

function makeRequest(body, {
  contentType = "application/json",
  origin = "https://deadlinemonitor.co.za",
  referer,
} = {}) {
  const headers = { "content-type": contentType };
  if (origin !== null) headers.origin = origin;
  if (referer) headers.referer = referer;
  return new Request("https://deadlinemonitor.co.za/api/enquiries", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function createHandler({
  env = config,
  sendEmail = async () => true,
} = {}) {
  return createEnquiryPostHandler({ env, sendEmail });
}

test("valid enquiry is accepted and formatted for the configured recipient", async () => {
  let delivered;
  const response = await createHandler({
    sendEmail: async (apiKey, email) => {
      assert.equal(apiKey, config.RESEND_API_KEY);
      delivered = email;
      return true;
    },
  })(makeRequest(validBody()));

  assert.equal(response.status, 201);
  assert.equal(delivered.to, "consultant1@compimento.co.za");
  assert.equal(delivered.replyTo, "ada@example.co.za");
  assert.equal(delivered.subject, "New Deadline Monitor enquiry - Example Company");
  assert.match(delivered.text, /Industry: Professional Services/);
  assert.match(delivered.text, /Recommended package: Standard/);
  assert.match(delivered.text, /Submitted \(Africa\/Johannesburg\):/);
  assert.match(delivered.html, /Ada Consultant/);
});

test("required fields, invalid email, telephone, consent, and oversized text are rejected", async (t) => {
  const cases = [
    ["missing required input", validBody({ contactName: "" })],
    ["invalid email", validBody({ email: "not-an-email" })],
    ["invalid telephone", validBody({ phone: "call me" })],
    ["missing privacy consent", validBody({ privacyConsent: false })],
    ["oversized input", validBody({ message: "x".repeat(2001) })],
  ];
  for (const [name, body] of cases) {
    await t.test(name, async () => {
      let sent = false;
      const response = await createHandler({
        sendEmail: async () => {
          sent = true;
          return true;
        },
      })(makeRequest(body));
      assert.equal(response.status, 400);
      assert.equal(sent, false);
    });
  }
});

test("honeypot submissions are rejected without sending email", async () => {
  let sent = false;
  const response = await createHandler({
    sendEmail: async () => {
      sent = true;
      return true;
    },
  })(makeRequest(validBody({ website: "spam" })));

  assert.equal(response.status, 400);
  assert.equal(sent, false);
});

test("invalid origin and non-JSON requests are rejected", async (t) => {
  await t.test("invalid origin", async () => {
    const response = await createHandler()(makeRequest(validBody(), {
      origin: "https://attacker.example",
    }));
    assert.equal(response.status, 403);
  });

  await t.test("non-JSON content type", async () => {
    const response = await createHandler()(makeRequest(validBody(), {
      contentType: "text/plain",
    }));
    assert.equal(response.status, 415);
  });
});

test("Vercel deployment origin and matching referer are allowed", async () => {
  const response = await createHandler()(makeRequest(validBody(), {
    origin: "https://deadline-monitor.vercel.app",
    referer: "https://deadline-monitor.vercel.app/get-started",
  }));
  assert.equal(response.status, 201);
});

test("missing email configuration and provider rejection return safe errors", async (t) => {
  await t.test("missing configuration", async () => {
    const response = await createHandler({
      env: { RESEND_API_KEY: "test-secret-key" },
    })(makeRequest(validBody()));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /test-secret-key/);
  });

  await t.test("provider rejection", async () => {
    const response = await createHandler({
      sendEmail: async () => false,
    })(makeRequest(validBody()));
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /test-secret-key|Resend/);
  });
});

test("HTML content escapes all user-controlled markup", async () => {
  let delivered;
  const response = await createHandler({
    sendEmail: async (_apiKey, email) => {
      delivered = email;
      return true;
    },
  })(makeRequest(validBody({
    companyName: `<img src=x onerror="alert('x')">`,
    message: "<script>alert('&')</script>",
  })));

  assert.equal(response.status, 201);
  assert.match(delivered.html, /&lt;img src=x onerror=&quot;alert\(&#39;x&#39;\)&quot;&gt;/);
  assert.match(delivered.html, /&lt;script&gt;alert\(&#39;&amp;&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(delivered.html, /<script>|<img/);
});

test("HTML escaping covers text-node metacharacters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
});

test("unknown fields such as attachments are rejected", async () => {
  const response = await createHandler()(makeRequest(validBody({
    attachments: ["document.pdf"],
  })));
  assert.equal(response.status, 400);
});
