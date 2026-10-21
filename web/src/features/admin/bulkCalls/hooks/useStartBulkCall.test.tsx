import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import { adminBulkCallsClient } from "../../../../lib/admin-bulk-calls-client";
import { useStartBulkCall } from "./useStartBulkCall";

vi.mock("../../../../lib/admin-bulk-calls-client", () => ({ adminBulkCallsClient: { startBatch: vi.fn() } }));

const client = vi.mocked(adminBulkCallsClient);

afterEach(() => client.startBatch.mockReset());

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  );
}

const selection = { voiceId: "voice-1", stageCode: "verified", limit: 200 };
const result = { id: "batch-1" } as never;

describe("useStartBulkCall", () => {
  it("replays the same Idempotency-Key when the same selection is retried after a failure", async () => {
    client.startBatch.mockRejectedValueOnce({ code: "NETWORK_ERROR" }).mockResolvedValue(result);
    const { result: hook } = renderHook(() => useStartBulkCall(), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync(selection).catch(() => undefined);
    });
    await act(async () => {
      await hook.current.mutateAsync(selection);
    });

    const [first, second] = client.startBatch.mock.calls.map((call) => call[0].idempotencyKey);
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("uses a new key for a different selection, and for the next batch after a success", async () => {
    client.startBatch.mockResolvedValue(result);
    const { result: hook } = renderHook(() => useStartBulkCall(), { wrapper });

    await act(async () => {
      await hook.current.mutateAsync(selection);
    });
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    await act(async () => {
      await hook.current.mutateAsync(selection);
    });
    await act(async () => {
      await hook.current.mutateAsync({ ...selection, stageCode: "fee_paid" });
    });

    const keys = client.startBatch.mock.calls.map((call) => call[0].idempotencyKey);
    expect(new Set(keys).size).toBe(3);
  });
});
