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

const { getEffectiveClientTaskOwnerId } = require("./clientTaskSelectors.ts");

test("client task owner defaults to the first active person without mutating form state", () => {
  assert.equal(
    getEffectiveClientTaskOwnerId("", [{ id: "active-a" }, { id: "active-b" }]),
    "active-a",
  );
  assert.equal(getEffectiveClientTaskOwnerId("selected", [{ id: "active-a" }]), "selected");
  assert.equal(getEffectiveClientTaskOwnerId("", []), "");
});
