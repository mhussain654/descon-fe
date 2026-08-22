import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api-client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("api-client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ hello: "world" }))
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.get("/ping")).resolves.toEqual({ hello: "world" });
  });

  it("resolves with undefined for a 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.del("/thing/1")).resolves.toBeUndefined();
  });

  it("normalizes a network failure as NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.get("/ping")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("normalizes a non-OK JSON error response, preferring the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { message: "Candidate not found" },
          { status: 404, statusText: "Not Found" }
        )
      )
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.get("/candidates/999")).rejects.toMatchObject({
      status: 404,
      code: "HTTP_4XX",
      message: "Candidate not found",
    });
  });

  it("classifies 5xx responses as HTTP_5XX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
      )
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.get("/candidates")).rejects.toMatchObject({
      status: 500,
      code: "HTTP_5XX",
    });
  });

  it("normalizes an unparseable JSON body as PARSE_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not json", { status: 200 }))
    );
    const client = createApiClient({ baseUrl: "http://example.test" });
    await expect(client.get("/ping")).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("sends a JSON content-type and body for requests with a payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createApiClient({ baseUrl: "http://example.test" });
    await client.post("/candidates", { full_name: "Test" });

    const [, requestInit] = fetchMock.mock.calls[0];
    expect(requestInit.method).toBe("POST");
    expect(requestInit.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(requestInit.body)).toEqual({ full_name: "Test" });
  });
});
