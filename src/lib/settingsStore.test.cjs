/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    request = path.resolve(__dirname, "..", `${request.slice(2)}.ts`);
  }
  return resolveFilename.call(this, request, parent, isMain, options);
};

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

const {
  CURRENT_PACKAGE_PRICING_VERSION,
  defaultPackages,
  defaultSettings,
  getSettings,
  SETTINGS_KEY,
} = require("./settingsStore.ts");

function installStorage(t, storedValue) {
  const values = new Map(storedValue ? [[SETTINGS_KEY, storedValue]] : []);
  const writes = [];
  const previousWindow = global.window;
  const previousLocalStorage = global.localStorage;

  global.window = {};
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
      writes.push([key, value]);
    },
  };

  t.after(() => {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }

    if (previousLocalStorage === undefined) {
      delete global.localStorage;
    } else {
      global.localStorage = previousLocalStorage;
    }
  });

  return { values, writes };
}

test("default packages retain the approved pricing, record and user limits", () => {
  assert.equal(CURRENT_PACKAGE_PRICING_VERSION, 4);
  assert.deepEqual(
    defaultPackages.map(
      ({ name, setupFee, monthlyFee, recordLimit, userLimit }) => [
        name,
        setupFee,
        monthlyFee,
        recordLimit,
        userLimit,
      ],
    ),
    [
      ["Starter", 500, 399, 25, 1],
      ["Standard", 1000, 799, 75, 4],
      ["Managed", 2000, 1499, 150, 12],
      ["Custom", 0, 2500, 500, 20],
    ],
  );
});

test("repairs stored version 3 package terms while preserving other settings", (t) => {
  const previousSettings = {
    ...defaultSettings,
    packagePricingVersion: 3,
    businessName: "Saved business name",
    retentionMonths: 36,
    supportEmail: "saved@example.invalid",
    packages: defaultPackages.map((clientPackage) => ({
      ...clientPackage,
      setupFee:
        clientPackage.name === "Starter"
          ? 1500
          : clientPackage.name === "Standard"
            ? 2500
            : clientPackage.name === "Managed"
              ? 4500
              : clientPackage.setupFee,
      userLimit:
        ["Starter", "Standard", "Managed"].includes(clientPackage.name)
          ? 12
          : clientPackage.userLimit,
    })),
  };
  const storage = installStorage(t, JSON.stringify(previousSettings));

  const migratedSettings = getSettings();
  const packages = new Map(
    migratedSettings.packages.map((clientPackage) => [
      clientPackage.name,
      clientPackage,
    ]),
  );

  assert.equal(migratedSettings.packagePricingVersion, 4);
  assert.equal(migratedSettings.businessName, previousSettings.businessName);
  assert.equal(migratedSettings.retentionMonths, previousSettings.retentionMonths);
  assert.equal(migratedSettings.supportEmail, previousSettings.supportEmail);
  assert.deepEqual(packages.get("Starter"), {
    ...previousSettings.packages[0],
    setupFee: 500,
    userLimit: 1,
  });
  assert.deepEqual(packages.get("Standard"), {
    ...previousSettings.packages[1],
    setupFee: 1000,
    userLimit: 4,
  });
  assert.deepEqual(packages.get("Managed"), {
    ...previousSettings.packages[2],
    setupFee: 2000,
    userLimit: 12,
  });
  assert.deepEqual(packages.get("Custom"), previousSettings.packages[3]);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0][0], SETTINGS_KEY);
  const persistedSettings = JSON.parse(storage.values.get(SETTINGS_KEY));
  assert.equal(persistedSettings.packagePricingVersion, 4);
  assert.deepEqual(
    persistedSettings.packages.map(
      ({ name, setupFee, monthlyFee, recordLimit, userLimit }) => [
        name,
        setupFee,
        monthlyFee,
        recordLimit,
        userLimit,
      ],
    ),
    [
      ["Starter", 500, 399, 25, 1],
      ["Standard", 1000, 799, 75, 4],
      ["Managed", 2000, 1499, 150, 12],
      ["Custom", 0, 2500, 500, 20],
    ],
  );
});
