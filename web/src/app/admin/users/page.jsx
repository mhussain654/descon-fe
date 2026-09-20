import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StaffShell } from "../../components/staff-shell";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useStaffAuth } from "../../../contexts/StaffAuthContext";
import { RequireStaffAuth } from "../../../features/staffAuth/RequireStaffAuth";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  EmptyState,
  ErrorState,
  FilterChip,
  Input,
  LoadingState,
  SearchField,
  Select,
  ValidationMessage,
  toast,
} from "../../../design-system";
import { STAFF_ROLE_LABEL_KEYS, STAFF_ROLE_RANK } from "../../../../../shared/auth/staffTypes";
import { staffDirectoryClient } from "../../../lib/staff-directory-client";
import { ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";

const ROLES = ["admin", "hr", "mps", "finance", "management"];
const STATUSES = ["active", "invited", "suspended"];
const ROLE_LABEL_KEYS = STAFF_ROLE_LABEL_KEYS;
const STATUS_LABEL_KEYS = {
  active: "staffAdminStatusActive",
  invited: "staffAdminStatusInvited",
  suspended: "staffAdminStatusSuspended",
};
const STATUS_TONE = { active: "success", invited: "info", suspended: "danger" };

const STAFF_DIRECTORY_QUERY_KEY = "staff-directory";

/**
 * Maps a rejected mutation's ApiError to a display message -- form-level
 * unless the error names a specific field. The real backend distinguishes
 * every domain validation failure (duplicate email, last-admin protection,
 * self-suspension, invalid state transition) only by `field`, not a
 * separate code per case (confirmed against descon-be's openapi.yaml --
 * all are `422 validation_failed`) -- so this uses the backend's own
 * already-localized message directly (it honors the same `X-Locale`
 * header the client sends) rather than inventing a client-side
 * translation-key taxonomy the backend doesn't actually support
 * distinguishing.
 */
function describeStaffAdminError(error, t) {
  const first = error?.errors?.[0];
  return { field: first?.field, message: first?.message ?? t("somethingWentWrong") };
}

export default function StaffUsersPage() {
  return (
    <StaffShell>
      <RequireStaffAuth permission="manage_staff_users">
        <StaffUsersContent />
      </RequireStaffAuth>
    </StaffShell>
  );
}

function StaffUsersContent() {
  const { t } = useLanguage();
  const { session } = useStaffAuth();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDialogMember, setRoleDialogMember] = useState(null);
  const [roleDialogValue, setRoleDialogValue] = useState("hr");
  const [pendingDowngrade, setPendingDowngrade] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

  const filters = useMemo(
    () => ({ query: query.trim() || undefined, role: roleFilter ?? undefined, status: statusFilter ?? undefined }),
    [query, roleFilter, statusFilter]
  );

  const staffQuery = useQuery({
    queryKey: [STAFF_DIRECTORY_QUERY_KEY, filters],
    queryFn: () => staffDirectoryClient.listStaff(filters),
  });

  const invalidateStaffList = () => queryClient.invalidateQueries({ queryKey: [STAFF_DIRECTORY_QUERY_KEY] });

  const inviteMutation = useMutation({
    mutationFn: (input) => staffDirectoryClient.inviteStaff(input),
    onSuccess: () => {
      invalidateStaffList();
      toast.success(t("staffAdminInviteSuccessToast"));
      setInviteOpen(false);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ staffId, role }) => staffDirectoryClient.updateStaffRole(staffId, role),
    onSuccess: () => {
      invalidateStaffList();
      toast.success(t("staffAdminRoleUpdatedToast"));
      setRoleDialogMember(null);
      setPendingDowngrade(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ staffId, status }) => staffDirectoryClient.updateStaffStatus(staffId, status),
    onSuccess: () => {
      invalidateStaffList();
      toast.success(t("staffAdminStatusUpdatedToast"));
      setSuspendTarget(null);
    },
  });

  function openRoleDialog(member) {
    roleMutation.reset();
    setRoleDialogValue(member.role);
    setRoleDialogMember(member);
  }

  function saveRoleChange() {
    if (!roleDialogMember || roleDialogValue === roleDialogMember.role) {
      setRoleDialogMember(null);
      return;
    }
    const isDowngrade = STAFF_ROLE_RANK[roleDialogValue] < STAFF_ROLE_RANK[roleDialogMember.role];
    if (isDowngrade) {
      // Hand off to the downgrade confirmation dialog rather than stacking
      // it on top of this one -- only one dialog is open at a time.
      setPendingDowngrade({ staffId: roleDialogMember.id, role: roleDialogValue });
      setRoleDialogMember(null);
      return;
    }
    roleMutation.mutate({ staffId: roleDialogMember.id, role: roleDialogValue });
  }

  function openSuspendConfirm(member) {
    statusMutation.reset();
    setSuspendTarget(member);
  }

  function activate(member) {
    statusMutation.mutate({ staffId: member.id, status: "active" });
  }

  const staff = staffQuery.data ?? [];
  const inviteError = inviteMutation.isError ? describeStaffAdminError(inviteMutation.error, t) : null;
  const roleError = roleMutation.isError ? describeStaffAdminError(roleMutation.error, t) : null;
  const statusError = statusMutation.isError ? describeStaffAdminError(statusMutation.error, t) : null;

  const columns = [
    {
      key: "email",
      header: t("staffAdminTableEmail"),
      render: (member) => (
        <div className="flex items-center gap-2 font-medium text-text-primary">
          {member.email}
          {member.id === session?.staffId ? <Badge tone="brand">{t("staffAdminYouBadge")}</Badge> : null}
        </div>
      ),
    },
    {
      key: "role",
      header: t("staffAdminTableRole"),
      render: (member) => <Badge tone="neutral">{t(ROLE_LABEL_KEYS[member.role])}</Badge>,
    },
    {
      key: "status",
      header: t("staffAdminTableStatus"),
      render: (member) => <Badge tone={STATUS_TONE[member.status]}>{t(STATUS_LABEL_KEYS[member.status])}</Badge>,
    },
    {
      key: "created",
      header: t("staffAdminTableCreated"),
      render: (member) => new Date(member.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: t("staffAdminTableActions"),
      render: (member) => {
        if (member.id === session?.staffId) return null;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openRoleDialog(member)}>
              {t("staffAdminChangeRole")}
            </Button>
            {member.status === "suspended" ? (
              <Button variant="outline" size="sm" onClick={() => activate(member)} loading={statusMutation.isPending}>
                {t("staffAdminActivate")}
              </Button>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => openSuspendConfirm(member)}>
                {t("staffAdminSuspend")}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-brand shadow-md">
        <div aria-hidden="true" className="absolute -right-14 -top-20 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 right-40 h-36 w-36 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white"><Users className="h-5 w-5" /></div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/70">{t("staffAdminEyebrow")}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t("staffAdminTitle")}</h1>
              <p className="mt-1 text-sm text-white/80">{t("staffAdminSubtitle")}</p>
            </div>
          </div>
          <div className="[&_button]:border-white/30 [&_button]:bg-white [&_button]:text-brand">
            <InviteDialog
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) inviteMutation.reset();
              }}
              onInvite={(input) => inviteMutation.mutate(input)}
              isSubmitting={inviteMutation.isPending}
              error={inviteError}
              t={t}
            />
          </div>
        </div>
      </div>

      {!staffQuery.isLoading && !staffQuery.isError ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StaffMetric icon={Users} label={t("staffAdminMetricTotal")} value={staff.length} className="border-t-brand bg-brand-subtle/45 text-brand" />
          <StaffMetric icon={UserCheck} label={t("staffAdminMetricActive")} value={staff.filter((member) => member.status === "active").length} className="border-t-success bg-success-subtle/55 text-success-emphasis" />
          <StaffMetric icon={UserPlus} label={t("staffAdminMetricInvited")} value={staff.filter((member) => member.status === "invited").length} className="border-t-info bg-info-subtle/55 text-info-emphasis" />
          <StaffMetric icon={ShieldCheck} label={t("staffAdminMetricAdmins")} value={staff.filter((member) => member.role === "admin").length} className="border-t-warning bg-warning-subtle/55 text-warning-emphasis" />
        </div>
      ) : null}

      <Card className="mb-5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder={t("staffAdminSearchPlaceholder")}
            label={t("dsSearchLabel")}
            clearLabel={t("staffAdminClearSearch")}
          />
          <div className="flex flex-wrap gap-2">
            <FilterChip selected={roleFilter === null} onClick={() => setRoleFilter(null)}>
              {t("staffAdminFilterAllRoles")}
            </FilterChip>
            {ROLES.map((role) => (
              <FilterChip key={role} selected={roleFilter === role} onClick={() => setRoleFilter(role)}>
                {t(ROLE_LABEL_KEYS[role])}
              </FilterChip>
            ))}
            <FilterChip selected={statusFilter === null} onClick={() => setStatusFilter(null)}>
              {t("staffAdminFilterAllStatuses")}
            </FilterChip>
            {STATUSES.map((status) => (
              <FilterChip key={status} selected={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {t(STATUS_LABEL_KEYS[status])}
              </FilterChip>
            ))}
          </div>
        </div>
      </Card>

      {staffQuery.isLoading ? (
        <LoadingState message={t("loading")} />
      ) : staffQuery.isError ? (
        <ErrorState message={t("somethingWentWrong")} retryLabel={t("retry")} onRetry={() => staffQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={staff}
          getRowId={(member) => member.id}
          emptyState={<EmptyState title={t("staffAdminNoStaffFound")} />}
        />
      )}

      <RoleDialog
        member={roleDialogMember}
        value={roleDialogValue}
        onValueChange={setRoleDialogValue}
        onOpenChange={(open) => {
          if (!open) {
            setRoleDialogMember(null);
            roleMutation.reset();
          }
        }}
        onSave={saveRoleChange}
        isSubmitting={roleMutation.isPending}
        error={roleError}
        t={t}
      />

      <ConfirmDialog
        open={!!pendingDowngrade}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDowngrade(null);
            roleMutation.reset();
          }
        }}
        title={t("staffAdminConfirmRoleDowngradeTitle")}
        description={t("staffAdminConfirmRoleDowngradeDescription")}
        confirmLabel={t("dsDialogConfirm")}
        cancelLabel={t("dsDialogCancel")}
        closeLabel={t("dsClose")}
        confirmVariant="destructive"
        isConfirming={roleMutation.isPending}
        onConfirm={() => pendingDowngrade && roleMutation.mutate(pendingDowngrade)}
      >
        {roleError ? <ValidationMessage tone="error">{roleError.message}</ValidationMessage> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null);
            statusMutation.reset();
          }
        }}
        title={t("staffAdminConfirmSuspendTitle")}
        description={t("staffAdminConfirmSuspendDescription")}
        confirmLabel={t("staffAdminSuspend")}
        cancelLabel={t("dsDialogCancel")}
        closeLabel={t("dsClose")}
        confirmVariant="destructive"
        isConfirming={statusMutation.isPending}
        onConfirm={() => suspendTarget && statusMutation.mutate({ staffId: suspendTarget.id, status: "suspended" })}
      >
        {statusError ? <ValidationMessage tone="error">{statusError.message}</ValidationMessage> : null}
      </ConfirmDialog>
    </div>
  );
}

function StaffMetric({ icon: Icon, label, value, className }) {
  return (
    <div className={`rounded-xl border border-border border-t-4 p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</span><Icon className="h-4 w-4" /></div>
      <div className="text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onInvite, isSubmitting, error, t }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("hr");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setEmail("");
          setRole("hr");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary">{t("staffAdminInviteStaff")}</Button>
      </DialogTrigger>
      <DialogContent
        title={t("staffAdminInviteDialogTitle")}
        description={t("staffAdminInviteDialogDescription")}
        closeLabel={t("dsClose")}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onInvite({ email, role });
          }}
        >
          <Input
            type="email"
            label={t("email")}
            placeholder={t("staffAdminEnterEmail")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            errorMessage={error?.field === "email" ? error.message : undefined}
            disabled={isSubmitting}
            required
          />
          <Select
            label={t("staffAdminRoleLabel")}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={ROLES.map((value) => ({ value, label: t(ROLE_LABEL_KEYS[value]) }))}
            disabled={isSubmitting}
          />
          {error && error.field !== "email" ? <ValidationMessage tone="error">{error.message}</ValidationMessage> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t("dsDialogCancel")}
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {t("staffAdminSendInvite")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ member, value, onValueChange, onOpenChange, onSave, isSubmitting, error, t }) {
  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("staffAdminChangeRoleDialogTitle")}
        description={member ? `${member.email} · ${t("staffAdminChangeRoleDialogDescription")}` : undefined}
        closeLabel={t("dsClose")}
      >
        {member ? (
          <div className="space-y-4">
            <Select
              label={t("staffAdminRoleLabel")}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              options={ROLES.map((role) => ({ value: role, label: t(ROLE_LABEL_KEYS[role]) }))}
              disabled={isSubmitting}
            />
            {error ? <ValidationMessage tone="error">{error.message}</ValidationMessage> : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                {t("dsDialogCancel")}
              </Button>
              <Button variant="primary" onClick={onSave} loading={isSubmitting}>
                {t("save")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
