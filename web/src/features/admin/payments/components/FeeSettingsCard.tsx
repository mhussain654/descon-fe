import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useLanguage } from "../../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../../contexts/StaffAuthContext";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ForbiddenState,
  Input,
  LoadingState,
  RetryBanner,
  Textarea,
  ValidationMessage,
} from "../../../../design-system";
import { adminFeesClient } from "../../../../lib/admin-fees-client";
import { validFeeAmount } from "../../../../../../shared/adminFees/types";
import type {
  AdminFee,
  AdminFeeError,
  FeeUpdate,
} from "../../../../../../shared/adminFees/types";
import { paymentQueries } from "../../../../../../shared/queryKeys/paymentQueries";

import { useAdminFee } from "../hooks/useAdminFee";
import { adminFeeQueries } from "../../../../../../shared/queryKeys/adminFeeQueries";

export function FeeSettingsCard({ candidateId }: { candidateId?: string }) {
  const { t, language } = useLanguage();
  const { hasPermission, signOut } = useStaffAuth();
  const canRead =
    hasPermission("view_payments") || hasPermission("manage_payments");
  const client = useQueryClient();
  const query = useAdminFee(candidateId);
  const mutation = useMutation<AdminFee, AdminFeeError, FeeUpdate>({
    mutationFn: (input) => adminFeesClient.updateFee(input, candidateId),
    retry: false,
    onSuccess: (data) => {
      client.setQueryData(adminFeeQueries.detail(candidateId, language), data);
      client.invalidateQueries({ queryKey: adminFeeQueries.all });
      client.invalidateQueries({ queryKey: paymentQueries.all });
    },
  });
  const error = query.error ?? mutation.error;
  useEffect(() => {
    if (
      error?.code === "SESSION_EXPIRED" ||
      error?.code === "INACTIVE_ACCOUNT"
    ) {
      signOut(error.code === "SESSION_EXPIRED" ? "expired" : "manual");
    }
  }, [error, signOut]);
  if (!canRead) return null;
  if (query.isLoading)
    return (
      <Card>
        <LoadingState message={t("loading")} />
      </Card>
    );
  if (query.error?.code === "FORBIDDEN")
    return (
      <ForbiddenState
        title={t("dsForbiddenTitle")}
        description={t("staffAuthForbiddenError")}
      />
    );
  if (!query.data)
    return (
      <ErrorState
        message={query.error?.message || t("adminFeeLoadError")}
        retryLabel={t("retry")}
        onRetry={() => query.refetch()}
      />
    );
  return (
    <>
      {query.error ? (
        <RetryBanner
          message={query.error.message || t("adminFeeLoadError")}
          retryLabel={t("retry")}
          onRetry={() => query.refetch()}
        />
      ) : null}
      <FeeEditor
        key={`${candidateId ?? "default"}-${query.data.version}`}
        fee={query.data}
        candidateId={candidateId}
        canEdit={hasPermission("manage_payments")}
        mutation={mutation}
        onReload={() => {
          mutation.reset();
          query.refetch();
        }}
      />
    </>
  );
}

function FeeEditor({
  fee,
  candidateId,
  canEdit,
  mutation,
  onReload,
}: {
  fee: AdminFee;
  candidateId?: string;
  canEdit: boolean;
  onReload: () => void;
  mutation: ReturnType<typeof useMutation<AdminFee, AdminFeeError, FeeUpdate>>;
}) {
  const { t, language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(fee.overrideAmount ?? fee.defaultAmount);
  const [useDefault, setUseDefault] = useState(
    Boolean(candidateId) && fee.overrideAmount === null,
  );
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState(false);
  const editable =
    canEdit && !fee.locked && (!candidateId || Boolean(fee.assignmentId));
  const formatMoney = (value: string) =>
    new Intl.NumberFormat(language === "ur" ? "ur-PK" : "en-PK", {
      style: "currency",
      currency: fee.currencyCode,
    }).format(Number(value));
  function save(event: React.FormEvent) {
    event.preventDefault();
    setValidation(true);
    if (!validFeeAmount(amount) || !reason.trim() || reason.trim().length > 500)
      return;
    mutation.mutate(
      {
        amount: useDefault && candidateId ? null : amount,
        reason,
        expectedVersion: fee.version,
      },
      { onSuccess: () => setEditing(false) },
    );
  }
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-brand/10 p-3 text-brand">
            <Wallet aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t(
                candidateId ? "adminFeeCandidateTitle" : "adminFeeDefaultTitle",
              )}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {t(candidateId ? "adminFeeCandidateHelp" : "adminFeeDefaultHelp")}
            </p>
          </div>
        </div>
        {editable && !editing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              mutation.reset();
              setAmount(fee.overrideAmount ?? fee.defaultAmount);
              setUseDefault(
                Boolean(candidateId) && fee.overrideAmount === null,
              );
              setReason("");
              setValidation(false);
              setEditing(true);
            }}
          >
            {t(candidateId ? "adminFeeChange" : "adminFeeSetDefault")}
          </Button>
        ) : null}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-3xl font-semibold text-text-primary" dir="ltr">
          {formatMoney(fee.effectiveAmount)}
        </p>
        {candidateId ? (
          <Badge tone={fee.overrideAmount === null ? "neutral" : "info"}>
            {t(
              fee.overrideAmount === null
                ? "adminFeeUsingDefault"
                : "adminFeeOverride",
            )}
          </Badge>
        ) : null}
      </div>
      {candidateId && fee.overrideAmount !== null ? (
        <p className="mt-2 text-sm text-text-secondary">
          {t("adminFeeDefaultValue").replace(
            "%{amount}",
            formatMoney(fee.defaultAmount),
          )}
        </p>
      ) : null}
      {fee.locked ? (
        <p className="mt-3 text-sm text-text-secondary">
          {t("adminFeeLocked")}
        </p>
      ) : null}
      {candidateId && !fee.assignmentId ? (
        <p className="mt-3 text-sm text-text-secondary">
          {t("adminFeeNoAssignment")}
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p role="status" className="mt-3 text-sm text-success">
          {t("adminFeeSaved")}
        </p>
      ) : null}
      {editing ? (
        <form
          onSubmit={save}
          className="mt-5 space-y-4 border-t border-border pt-5"
        >
          {candidateId ? (
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={useDefault}
                onChange={(event) => {
                  setUseDefault(event.target.checked);
                  if (event.target.checked) setAmount(fee.defaultAmount);
                }}
                disabled={mutation.isPending}
              />
              {t("adminFeeUseDefault")}
            </label>
          ) : null}
          <Input
            label={t("adminFeeAmount").replace("%{currency}", fee.currencyCode)}
            inputMode="decimal"
            dir="ltr"
            value={amount}
            disabled={mutation.isPending}
            onChange={(event) => {
              setAmount(event.target.value);
              setUseDefault(false);
            }}
            errorMessage={
              validation && !validFeeAmount(amount)
                ? t("adminFeeInvalidAmount")
                : undefined
            }
          />
          <Textarea
            label={t("adminFeeReason")}
            value={reason}
            maxLength={500}
            disabled={mutation.isPending}
            onChange={(event) => setReason(event.target.value)}
            errorMessage={
              validation && !reason.trim()
                ? t("adminFeeReasonRequired")
                : undefined
            }
          />
          <p className="text-xs text-text-secondary">
            {t("adminFeePreserveBills")}
          </p>
          {mutation.error ? (
            <ValidationMessage tone="error">
              {mutation.error.message || t("adminFeeSaveError")}
            </ValidationMessage>
          ) : null}
          {mutation.error?.code === "STALE_FEE" ||
          mutation.error?.code === "FEE_LOCKED" ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-text-secondary">
                {t("adminFeeReloadHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  onReload();
                }}
              >
                {t("retry")}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setEditing(false);
                mutation.reset();
              }}
            >
              {t("dsDialogCancel")}
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={
                mutation.isPending ||
                mutation.error?.code === "STALE_FEE" ||
                mutation.error?.code === "FEE_LOCKED"
              }
            >
              {t("adminCandidateSaveAction")}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
