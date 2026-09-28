import { describe, it, expect } from "vitest";
import {
  ToolName,
  IMPLEMENTED_TOOLS,
  READ_ONLY_TOOLS,
  toolArgumentSchemas,
  validateToolArguments,
  ToolValidationError,
  getToolSchemasForModel,
} from "@/lib/ai/tools";

describe("validateToolArguments", () => {
  it("returns parsed data for valid arguments", () => {
    const result = validateToolArguments(ToolName.TASK_CREATE, JSON.stringify({ title: "Buy milk" }));
    expect(result).toEqual({ title: "Buy milk" });
  });

  it("accepts empty-args tools with an empty string", () => {
    const result = validateToolArguments(ToolName.HELP, "");
    expect(result).toEqual({});
  });

  it("throws ToolValidationError for an unknown tool name", () => {
    expect(() => validateToolArguments("NOT_A_REAL_TOOL", "{}")).toThrow(ToolValidationError);
  });

  it("throws ToolValidationError for invalid JSON", () => {
    expect(() => validateToolArguments(ToolName.TASK_CREATE, "{not json")).toThrow(ToolValidationError);
  });

  it("throws ToolValidationError when required fields are missing", () => {
    expect(() => validateToolArguments(ToolName.TASK_CREATE, JSON.stringify({}))).toThrow(ToolValidationError);
  });

  it("throws ToolValidationError when a field fails its constraint", () => {
    expect(() =>
      validateToolArguments(ToolName.MEMORY_CREATE, JSON.stringify({ fact: "x", category: "NOT_A_CATEGORY" }))
    ).toThrow(ToolValidationError);
  });

  it("every declared ToolName has a corresponding argument schema", () => {
    for (const name of Object.values(ToolName)) {
      expect(toolArgumentSchemas[name]).toBeDefined();
    }
  });
});

describe("tool catalog invariants", () => {
  it("every implemented tool is a declared tool name", () => {
    const allNames = new Set<string>(Object.values(ToolName));
    for (const name of IMPLEMENTED_TOOLS) {
      expect(allNames.has(name)).toBe(true);
    }
  });

  it("every read-only tool is a declared tool name", () => {
    const allNames = new Set<string>(Object.values(ToolName));
    for (const name of READ_ONLY_TOOLS) {
      expect(allNames.has(name)).toBe(true);
    }
  });

  it("PENDING_RESOLVE is not treated as read-only (it can drive a mutating follow-up)", () => {
    expect(READ_ONLY_TOOLS.has(ToolName.PENDING_RESOLVE)).toBe(false);
  });
});

describe("getToolSchemasForModel", () => {
  it("produces one schema entry per declared tool, each with a JSON schema body", () => {
    const schemas = getToolSchemasForModel();
    expect(schemas).toHaveLength(Object.values(ToolName).length);
    for (const schema of schemas) {
      expect(schema.name).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(schema.parametersJsonSchema).toBeTypeOf("object");
    }
  });
});
