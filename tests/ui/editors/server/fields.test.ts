import { describe, expect, it } from "vitest";
import { ServerFields } from "../../../../src/ui/editors/server/fields";
import type { LlamaServer } from "../../../../src/interfaces/settings";

const makeServer = (overrides: Partial<LlamaServer> = {}): LlamaServer =>
  ({
    url: "http://127.0.0.1:9931",
    id: "my-server",
    name: "My Server",
    ...overrides,
  }) as LlamaServer;

describe("ServerFields", () => {
  it("should have exactly 3 fields", () => {
    expect(ServerFields.all).toHaveLength(3);
  });

  it("should return the server url for the url field", () => {
    const field = ServerFields.byId("url");
    expect(field.currentValue(makeServer({ url: "http://example:8080" }))).toBe(
      "http://example:8080",
    );
  });

  it("should return the server id for the id field", () => {
    const field = ServerFields.byId("id");
    expect(field.currentValue(makeServer({ id: "custom-id" }))).toBe(
      "custom-id",
    );
  });

  it("should return empty string when id is undefined", () => {
    const field = ServerFields.byId("id");
    expect(field.currentValue(makeServer({ id: undefined }))).toBe("");
  });

  it("should return the server name for the name field", () => {
    const field = ServerFields.byId("name");
    expect(field.currentValue(makeServer({ name: "My Server" }))).toBe(
      "My Server",
    );
  });

  it("should return empty string when name is undefined", () => {
    const field = ServerFields.byId("name");
    expect(field.currentValue(makeServer({ name: undefined }))).toBe("");
  });

  it.each([
    ["url", "http://example:8080"],
    ["id", "new-id"],
    ["name", "New name"],
  ])("should preserve custom headers when editing %s", (id, value) => {
    const headers = { "CF-Access-Client-Id": "$CF_ID" };
    const server = makeServer({ headers });

    const updated = ServerFields.byId(id).apply(server, value);

    expect(updated.headers).toEqual(headers);
  });

  it("should throw for unknown field id", () => {
    expect(() => ServerFields.byId("unknown")).toThrow(
      "Unknown server field: unknown",
    );
  });
});
