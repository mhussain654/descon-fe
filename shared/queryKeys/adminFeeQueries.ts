import type { Language } from "../i18n/translations";

export const adminFeeQueries = {
  all: ["adminFees"] as const,
  detail: (candidateId: string | undefined, language: Language) =>
    ["adminFees", candidateId ?? "default", language] as const,
};
