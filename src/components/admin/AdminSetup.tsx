"use client";

import { BadgeCheck, Building, Clock, IndianRupee, RotateCcw, Save, Users } from "lucide-react";
import { useState } from "react";
import { Banner, Button, Card, Chip, EmptyState, Field, Input, Screen, ScreenTitle, Section, Sheet } from "@/components/ui";
import { useActingAs, useRepos } from "@/data/useRepos";
import { PACKAGE_LENGTHS } from "@/domain/packages";
import type { PackageKind, PackageLength, Payment, StaffRole } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { refundPayment, savePrices } from "@/store/roleActions";
import { useDemo } from "@/store/store";

const ROLE_ORDER: StaffRole[] = ["doctor", "nurse", "caregiver", "desk", "admin"];

export function AdminSetup() {
  const { t, person, text, money, date } = useT();
  const repos = useRepos();
  const adminId = useActingAs();
  const packages = repos.packages.list();
  const [prices, setPrices] = useState(() => Object.fromEntries(packages.map((p) => [p.id, { ...p.prices }])) as Record<PackageKind, Partial<Record<PackageLength | "month", number>>>);
  const [saved, setSaved] = useState(false);
  const [refund, setRefund] = useState<Payment | null>(null);
  if (!repos.can.audit) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const payments = repos.payments.all().slice().sort((a, b) => b.at - a.at);
  const setPrice = (kind: PackageKind, len: PackageLength | "month", v: string) => {
    setSaved(false);
    setPrices((p) => ({ ...p, [kind]: { ...p[kind], [len]: Number(v) } }));
  };
  return (
    <Screen wide>
      <ScreenTitle title={t("nav.admin.setup")} />

      <Section title={t("admin.setup.users")} icon={Users}>
        <div className="grid gap-3 @desk:grid-cols-2">
          {ROLE_ORDER.map((r) => {
            const people = repos.staff.list(r);
            return (
              <Card key={r} className="space-y-2">
                <p className="flex items-center justify-between font-bold">
                  {t(`roles.${r}.name`)} <span className="text-sm font-normal text-muted">{t("admin.setup.count", { count: people.length })}</span>
                </p>
                <ul className="space-y-1">
                  {people.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {person(s.id)}
                        {s.speciality ? <span className="text-sm text-muted"> · {text(s.speciality)}</span> : null}
                      </span>
                      {s.caregiver && (
                        <Chip size="sm" tone={s.caregiver.verified ? "ok" : "warn"} icon={s.caregiver.verified ? BadgeCheck : Clock}>
                          {s.caregiver.verified ? t("admin.setup.verified") : t("admin.setup.pending")}
                        </Chip>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          <Card className="space-y-1">
            <p className="flex items-center justify-between font-bold">
              {t("admin.setup.family")} <span className="text-sm font-normal text-muted">{t("admin.setup.count", { count: repos.family.all().length })}</span>
            </p>
            <p className="text-sm text-muted">{repos.family.all().map((f) => text(f.name)).join(", ")}</p>
          </Card>
        </div>
      </Section>

      <Section title={t("admin.setup.orgs")} icon={Building}>
        <OrgCard />
      </Section>

      <Section title={t("admin.setup.packages")} icon={IndianRupee}>
        <p className="text-muted">{t("admin.setup.pricesHelp")}</p>
        <Card className="space-y-4">
          {packages.map((p) => (
            <fieldset key={p.id} className="space-y-2">
              <legend className="font-bold">{t(`pkg.name.${p.id}`)}</legend>
              <div className="grid gap-3 @md:grid-cols-3">
                {(p.id === "monthly" ? (["month"] as const) : PACKAGE_LENGTHS).map((len) => (
                  <Field key={len} label={len === "month" ? t("pkg.name.monthly") : t("pkg.length", { days: len })} htmlFor={`price-${p.id}-${len}`} hint={money(prices[p.id]?.[len] ?? 0)}>
                    <Input id={`price-${p.id}-${len}`} type="number" min={1} inputMode="numeric" value={prices[p.id]?.[len] ?? ""} onChange={(e) => setPrice(p.id, len, e.target.value)} />
                  </Field>
                ))}
              </div>
            </fieldset>
          ))}
          {saved && <Banner tone="ok">{t("admin.setup.pricesSaved")}</Banner>}
          <Button variant="primary" icon={Save} onClick={() => { savePrices(adminId, prices); setSaved(true); }}>
            {t("admin.setup.savePrices")}
          </Button>
        </Card>
      </Section>

      <Section title={t("admin.setup.payments")} icon={IndianRupee}>
        {payments.length === 0 ? (
          <EmptyState title={t("admin.setup.noPayments")} />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {payments.map((pay) => (
              <li key={pay.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{person(pay.patientId)}</p>
                  <p className="text-sm text-muted">
                    {date(pay.at)} · {t(`family.plan.purpose.${pay.purpose}`)} · {t(`pkg.name.${pay.kind}`)} · {t(`family.plan.method.${pay.method}`)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{money(pay.amount)}</span>
                  <Chip size="sm" tone={pay.status === "success" ? "ok" : pay.status === "failed" ? "danger" : "neutral"}>
                    {t(`family.plan.status.${pay.status}`)}
                  </Chip>
                  {pay.status === "success" && (
                    <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRefund(pay)}>
                      {t("admin.setup.refund")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Sheet
        open={refund != null}
        onClose={() => setRefund(null)}
        title={t("admin.setup.refund")}
        footer={
          <>
            <Button onClick={() => setRefund(null)}>{t("common.cancel")}</Button>
            <Button variant="danger" icon={RotateCcw} onClick={() => { if (refund) refundPayment(refund.id, adminId); setRefund(null); }}>
              {t("admin.setup.refund")}
            </Button>
          </>
        }
      >
        {refund && <p>{t("admin.setup.refundConfirm", { amount: money(refund.amount), patient: person(refund.patientId) })}</p>}
      </Sheet>
    </Screen>
  );
}

function OrgCard() {
  const { t, text } = useT();
  const h = useDemo((s) => s.data?.hospitals[0]);
  const patients = useDemo((s) => s.data?.patients.length ?? 0);
  if (!h) return null;
  return (
    <Card className="space-y-1">
      <p className="text-lg font-bold">{text(h.name)}</p>
      <p className="text-muted">
        {t("admin.setup.hospital")} · {text(h.city)} · {h.phone}
      </p>
      <p className="text-sm text-muted">{t("admin.overview.activePatients")}: {patients}</p>
    </Card>
  );
}
