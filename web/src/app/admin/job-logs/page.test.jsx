import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockStaffAuthClient,
  MOCK_STAFF_ACCOUNTS,
  MOCK_STAFF_PASSWORD,
} from "../../../../../shared/auth/staffAuthClient";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { StaffAuthProvider } from "../../../contexts/StaffAuthContext";
import AdminJobLogsPage from "./page";
import { adminJobLogsClient } from "../../../lib/admin-job-logs-client";

vi.mock("../../../lib/admin-job-logs-client", () => ({
  adminJobLogsClient: { listJobLogs: vi.fn() },
}));

// Only the developer mock account carries view_job_logs (shared/auth/staffAuthClient.ts).
const DEVELOPER = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "developer");
const ADMIN = MOCK_STAFF_ACCOUNTS.find((account) => account.role === "admin");

const JOB_CLASSES = ["CandidateSms::DeliveryJob", "Payments::IssueFeeVoucherJob"];

const failedRun = {
  id: 812,
  jobClass: "Payments::IssueFeeVoucherJob",
  queueName: "default",
  priority: 0,
  status: "failed",
  attempt: 5,
  enqueuedAt: "2026-11-14T08:00:00Z",
  failedAt: "2026-11-14T08:00:03Z",
  error: {
    exceptionClass: "Faraday::TimeoutError",
    message: "execution expired",
    backtrace: ["app/services/payments/kuickpay/client.rb:41:in 'post'"],
  },
};

const finishedRun = {
  id: 811,
  jobClass: "CandidateSms::DeliveryJob",
  queueName: "default",
  priority: 0,
  status: "finished",
  attempt: 1,
  enqueuedAt: "2026-11-14T07:00:00Z",
  finishedAt: "2026-11-14T07:00:01Z",
};

function page(items, totalPages = 1) {
  return {
    items,
    pagination: { page: 1, perPage: 25, totalCount: items.length, totalPages },
    jobClasses: JOB_CLASSES,
  };
}

async function signInAs(account) {
  const client = createMockStaffAuthClient({ delayMs: 0 });
  await client.signIn({ email: account.email, password: MOCK_STAFF_PASSWORD });
  return client;
}

function renderAt(path, client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <StaffAuthProvider client={client}>
            <Routes>
              <Route path="/admin/login" element={<p>Login stub</p>} />
              <Route path="/admin/forbidden" element={<p>Forbidden stub</p>} />
              <Route path="/admin/job-logs" element={<AdminJobLogsPage />} />
            </Routes>
          </StaffAuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("AdminJobLogsPage", () => {
  afterEach(() => {
    vi.mocked(adminJobLogsClient.listJobLogs).mockReset();
    sessionStorage.clear();
  });

  it("lists job runs for a developer and expands a failed run to show why it failed", async () => {
    adminJobLogsClient.listJobLogs.mockResolvedValue(page([failedRun, finishedRun]));
    renderAt("/admin/job-logs", await signInAs(DEVELOPER));

    expect(await screen.findByRole("heading", { name: "Job logs" })).toBeInTheDocument();
    expect((await screen.findAllByText("Payments::IssueFeeVoucherJob", { selector: "p" })).length).toBeGreaterThan(0);
    expect(screen.getByText("Faraday::TimeoutError")).toBeInTheDocument();
    expect(screen.getByText("Finished", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("execution expired")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show error" }));

    expect(screen.getByText("execution expired")).toBeInTheDocument();
    expect(screen.getByText("app/services/payments/kuickpay/client.rb:41:in 'post'")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide error" })).toHaveAttribute("aria-expanded", "true");
  });

  it("offers every job class in the dropdown and filters by job, status and dates", async () => {
    adminJobLogsClient.listJobLogs.mockResolvedValue(page([finishedRun]));
    renderAt("/admin/job-logs", await signInAs(DEVELOPER));

    const jobSelect = await screen.findByLabelText("Job");
    await waitFor(() => expect(screen.getByRole("option", { name: "CandidateSms::DeliveryJob" })).toBeInTheDocument());

    fireEvent.change(jobSelect, { target: { value: "CandidateSms::DeliveryJob" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "failed" } });
    fireEvent.change(screen.getByLabelText("Enqueued from"), { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Enqueued to"), { target: { value: "2026-11-14" } });

    await waitFor(() =>
      expect(adminJobLogsClient.listJobLogs).toHaveBeenLastCalledWith(
        {
          jobClass: "CandidateSms::DeliveryJob",
          status: "failed",
          enqueuedFrom: "2026-11-01",
          enqueuedTo: "2026-11-14",
        },
        { number: undefined }
      )
    );
  });

  it("shows the filtered empty state when no run matches", async () => {
    adminJobLogsClient.listJobLogs.mockResolvedValue(page([]));
    renderAt("/admin/job-logs?status=failed", await signInAs(DEVELOPER));

    expect(await screen.findByText("No job runs match these filters")).toBeInTheDocument();
  });

  it("shows an error with a retry that loads again", async () => {
    adminJobLogsClient.listJobLogs.mockRejectedValueOnce({ code: "SERVER_ERROR" }).mockResolvedValue(page([finishedRun]));
    renderAt("/admin/job-logs", await signInAs(DEVELOPER));

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("CandidateSms::DeliveryJob", { selector: "p" })).toBeInTheDocument();
  });

  it("sends staff without view_job_logs (even admin) to the forbidden page without calling the API", async () => {
    renderAt("/admin/job-logs", await signInAs(ADMIN));

    expect(await screen.findByText("Forbidden stub")).toBeInTheDocument();
    expect(adminJobLogsClient.listJobLogs).not.toHaveBeenCalled();
  });

  it("sends an unauthenticated visitor to staff login", async () => {
    renderAt("/admin/job-logs", createMockStaffAuthClient({ delayMs: 0 }));

    await waitFor(() => expect(screen.getByText("Login stub")).toBeInTheDocument());
  });
});
