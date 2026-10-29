import { describe, expect, it, vi } from "vitest";
import { ServerFactory } from "../../src/servers/serverFactory";
import { ServerStatus } from "../../src/enums/serverStatus";
import { makeResolverStub } from "../mocks/settings";

/** Builds a fetchFn that returns the given response impl. */
const stubFetch = (
  impl: (url: string, init?: RequestInit) => Promise<unknown>,
) => vi.fn(impl as typeof globalThis.fetch);

describe("ServerFactory.create", () => {
  it("should send the resolved custom headers on the probes", async () => {
    const resolveHeaders = vi.fn(() => ({
      "CF-Access-Client-Id": "resolved-id",
    }));
    const resolver = makeResolverStub({ resolveHeaders });
    const options = {
      baseUrl: "https://llama.example.com",
      headers: { "CF-Access-Client-Id": "$CF_ID" },
    };

    // Behind Cloudflare Access, requests without the header never reach
    // the server: model that as a network failure.
    const result = await new ServerFactory().create(
      resolver,
      options,
      1000,
      stubFetch(async (url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers?.["CF-Access-Client-Id"] !== "resolved-id")
          throw new Error("blocked by Cloudflare Access");
        if (url.includes("/health"))
          return { ok: true, status: 200, json: async () => ({}) };
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: "gguf-model.gguf" }] }),
        };
      }),
    );

    expect(result.status).toBe(ServerStatus.READY);
    expect(resolveHeaders).toHaveBeenCalledWith(
      "llama-server=https://llama.example.com",
      options.headers,
    );
  });

  it("should resolve the URL-based provider ID when customId is unset", async () => {
    const resolver = makeResolverStub({
      resolveApiKey: vi.fn((id) =>
        id === "llama-server=http://127.0.0.1:9931"
          ? "my-secret-key"
          : "placeholder",
      ),
    });

    const factory = new ServerFactory();
    const result = await factory.create(
      resolver,
      { baseUrl: "http://127.0.0.1:9931" },
      1000,
      stubFetch(async (url: string, init?: RequestInit) => {
        if (url.includes("/health"))
          return { ok: true, status: 200, json: async () => ({}) };
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers?.Authorization === "Bearer my-secret-key")
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "gguf-model.gguf", aliases: ["llama"] }],
            }),
          };
        return { ok: false, status: 401, json: async () => ({}) };
      }),
    );

    expect(result.status).toBe(ServerStatus.READY);
    expect(resolver.resolveApiKey).toHaveBeenCalledWith(
      "llama-server=http://127.0.0.1:9931",
    );
  });

  it("should prefer customId over URL-derived ID for key resolution", async () => {
    const resolver = makeResolverStub({
      resolveApiKey: vi.fn((id) =>
        id === "my-custom-id" ? "custom-key" : "placeholder",
      ),
    });

    const factory = new ServerFactory();
    await factory.create(
      resolver,
      { baseUrl: "http://127.0.0.1:9931", customId: "my-custom-id" },
      1000,
      stubFetch(async (url: string, init?: RequestInit) => {
        if (url.includes("/health"))
          return { ok: true, status: 200, json: async () => ({}) };
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers?.Authorization === "Bearer custom-key")
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "gguf-model.gguf", aliases: ["llama"] }],
            }),
          };
        return { ok: false, status: 401, json: async () => ({}) };
      }),
    );

    expect(resolver.resolveApiKey).toHaveBeenCalledWith("my-custom-id");
  });
});
