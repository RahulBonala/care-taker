"use client";

import { useState } from "react";
import { ROLE_ICONS } from "@/components/roles/registry";
import { Chip, EmptyState, Screen, ScreenTitle, Select } from "@/components/ui";
import { useRepos } from "@/data/useRepos";
import type { AuditEntry } from "@/domain/types";
import { ROLES } from "@/domain/types";
import { useT } from "@/i18n/useT";

const ACTIONS: AuditEntry["action"][] = ["viewed", "created", "changed", "verified", "closed", "sent", "blocked", "paid", "refunded", "withdrawn", "signedIn"];

export function AdminAudit() {
  const { t, tx, time, dayMonth, person } = useT();
  const repos = useRepos();
  const [role, setRole] = useState("all");
  const [action, setAction] = useState("all");
  if (!repos.can.audit) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const list = repos.audit
    .list()
    .filter((a) => (role === "all" || a.actorRole === role) && (action === "all" || a.action === action))
    .slice()
    .reverse()
    .slice(0, 200);
  return (
    <Screen wide>
      <ScreenTitle title={t("admin.audit.title")} subtitle={t("admin.audit.intro")} />
      <div className="grid gap-3 @md:grid-cols-2">
        <Select aria-label={t("admin.audit.allRoles")} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">{t("admin.audit.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}.name`)}
            </option>
          ))}
          <option value="system">{t("admin.audit.system")}</option>
        </Select>
        <Select aria-label={t("admin.audit.allActions")} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">{t("admin.audit.allActions")}</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`admin.audit.actions.${a}`)}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-muted">{t("admin.audit.showing", { count: list.length })}</p>
      {list.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} />
      ) : (
        <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((a) => {
            const Icon = a.actorRole !== "system" ? ROLE_ICONS[a.actorRole] : null;
            return (
              <li key={a.id} className="grid gap-1 px-4 py-3 @md:grid-cols-[9rem_1fr]">
                <span className="text-sm text-muted tabular-nums">
                  {dayMonth(a.at)}, {time(a.at)}
                </span>
                <div className="min-w-0 space-y-1">
                  <p>{tx(a.key, a.params)}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip size="sm" tone="neutral">
                      {Icon ? <Icon aria-hidden size={12} className="mr-1 inline" /> : null}
                      {a.actorRole === "system" ? t("admin.audit.system") : `${person(a.actorId) || a.actorId} · ${t(`roles.${a.actorRole}.short`)}`}
                    </Chip>
                    <Chip size="sm" tone={a.action === "viewed" ? "info" : a.action === "blocked" || a.action === "withdrawn" ? "warn" : "brand"}>
                      {t(`admin.audit.actions.${a.action}`)}
                    </Chip>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
