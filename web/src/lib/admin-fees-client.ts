import { createAdminFeesClient } from "../../../shared/adminFees/realAdminFeesClient";
import { apiClient } from "./api-client";
import { staffAuthClient } from "./staff-auth-client";
export const adminFeesClient = createAdminFeesClient({
  apiClient,
  staffAuthClient,
  getLocale: () =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("descon.language") === "ur"
      ? "ur"
      : "en",
});
