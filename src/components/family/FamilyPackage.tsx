"use client";

import { CircleCheck, CircleX, CreditCard, Loader, Receipt, RefreshCw, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Banner, Button, Card, Chip, EmptyState, Field, Input, KV, Screen, ScreenTitle, Section, Segmented, Sheet } from "@/components/ui";
import { daysLeft, MONTH_DAYS, PACKAGE_LENGTHS, renewalDue } from "@/domain/packages";
import type { PackageKind, Patient } from "@/domain/types";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { localDate } from "@/lib/time";
import { pay, setPaymentOutcome, type PaymentPurpose } from "@/store/roleActions";
import { useDemo } from "@/store/store";
import { useFamily } from "./useFamily";

interface Choice {
  kind: PackageKind;
  lengthDays: number;
  purpose: PaymentPurpose;
}

export function FamilyPackage() {
  const { t, date, money, person } = useT();
  const { repos, f, p, now, familyId } = useFamily();
  const [choice, setChoice] = useState<Choice | null>(null);
  const renewSpot = useSpot<HTMLButtonElement>("family.renew");
  const monthlySpot = useSpot<HTMLButtonElement>("family.monthly");
  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const today = localDate(now);
  const left = daysLeft(p, today);
  const payments = repos.payments.forPatient(p.id).slice().reverse();
  const due = renewalDue(p, today);
  const price = (kind: PackageKind, len: number) => repos.packages.price(kind, len);
  const lengths = p.pkg.kind === "monthly" ? [] : PACKAGE_LENGTHS;

  return (
    <Screen>
      <ScreenTitle title={t("family.plan.title")} subtitle={person(p.id)} />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{t(`pkg.name.${p.pkg.kind}`)}</h2>
          <Chip tone={p.pkg.status === "active" ? "ok" : "warn"} icon={p.pkg.status === "active" ? CircleCheck : CircleX}>
            {t(`pkg.status.${p.pkg.status}`)}
          </Chip>
        </div>
        <p className="text-muted">{t(`pkg.desc.${p.pkg.kind}`)}</p>
        <KV
          rows={[
            [t("family.plan.current"), p.pkg.kind === "monthly" ? t("pkg.perMonth", { price: money(price("monthly", MONTH_DAYS)) }) : t("pkg.length", { days: p.pkg.lengthDays })],
            [t("common.date"), t("family.plan.period", { from: date(p.pkg.startDate), to: date(p.pkg.endDate) })],
            [t("common.status"), p.pkg.status === "expired" ? t("family.plan.ended", { date: date(p.pkg.endDate) }) : t("family.plan.daysLeft", { count: left })],
            [t("family.plan.payments"), p.pkg.paid ? t("family.plan.paid") : t("family.plan.unpaid")],
          ]}
        />
        {!p.pkg.paid && (
          <Button variant="primary" size="lg" icon={CreditCard} onClick={() => setChoice({ kind: p.pkg.kind, lengthDays: p.pkg.lengthDays, purpose: "new" })}>
            {t("family.home.payNow")}
          </Button>
        )}
      </Card>

      {p.packageRequest && (
        <Banner
          tone="info"
          icon={Stethoscope}
          title={t("family.home.doctorAsked", { doctor: person(p.packageRequest.by), days: p.packageRequest.lengthDays })}
          action={
            <Button size="sm" variant="primary" onClick={() => setChoice({ kind: p.pkg.kind === "monthly" ? "call" : p.pkg.kind, lengthDays: p.packageRequest!.lengthDays, purpose: "extension" })}>
              {t("family.plan.choose")} · {money(price(p.pkg.kind === "monthly" ? "call" : p.pkg.kind, p.packageRequest.lengthDays))}
            </Button>
          }
        />
      )}

      {(due || p.pkg.status === "expired") && <Banner tone="brand" icon={RefreshCw} title={p.pkg.status === "expired" ? t("family.home.endedTitle") : t("family.home.renewTitle", { when: t("common.today").toLowerCase() })}>{t("family.home.renewBody")}</Banner>}

      <Section title={t("family.plan.options")}>
        <div className="grid gap-3 @md:grid-cols-2">
          {lengths.map((len, i) => (
            <Card key={len} className="flex flex-col gap-2">
              <p className="font-bold">
                {t("family.plan.renew")} · {t(`pkg.name.${p.pkg.kind}`)}
              </p>
              <p className="text-2xl font-bold tabular-nums">{money(price(p.pkg.kind, len))}</p>
              <p className="text-muted">{t("pkg.length", { days: len })}</p>
              <Button
                ref={i === 1 ? renewSpot.ref : undefined}
                variant={due ? "primary" : "secondary"}
                className={i === 1 ? renewSpot.className : undefined}
                onClick={() => setChoice({ kind: p.pkg.kind, lengthDays: len, purpose: "renewal" })}
              >
                {t("family.plan.choose")}
              </Button>
            </Card>
          ))}
          {p.pkg.kind !== "monthly" && (
            <Card className="flex flex-col gap-2 border-brand">
              <p className="font-bold">{t("family.plan.monthly")}</p>
              <p className="text-2xl font-bold tabular-nums">{t("pkg.perMonth", { price: money(price("monthly", MONTH_DAYS)) })}</p>
              <p className="text-muted">{t("pkg.desc.monthly")}</p>
              <Button ref={monthlySpot.ref} className={monthlySpot.className} variant="soft" onClick={() => setChoice({ kind: "monthly", lengthDays: MONTH_DAYS, purpose: "monthly" })}>
                {t("family.plan.choose")}
              </Button>
            </Card>
          )}
          {p.pkg.kind === "monthly" && <p className="text-muted">{t("pkg.desc.monthly")}</p>}
        </div>
        <p className="text-sm text-muted">{t("family.plan.renewHelp")}</p>
      </Section>

      <Section title={t("family.plan.payments")} icon={Receipt}>
        {payments.length === 0 ? (
          <EmptyState title={t("family.plan.noPayments")} />
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {payments.map((pay) => (
              <li key={pay.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t(`family.plan.purpose.${pay.purpose}`)} · {t(`pkg.name.${pay.kind}`)}
                  </p>
                  <p className="text-sm text-muted">
                    {date(pay.at)} · {t(`family.plan.method.${pay.method}`)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{money(pay.amount)}</span>
                  <Chip size="sm" tone={pay.status === "success" ? "ok" : pay.status === "failed" ? "danger" : "neutral"} icon={pay.status === "success" ? CircleCheck : pay.status === "failed" ? CircleX : RefreshCw}>
                    {t(`family.plan.status.${pay.status}`)}
                  </Chip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PaymentSheet p={p} familyId={familyId} choice={choice} onClose={() => setChoice(null)} />
    </Screen>
  );
}

function PaymentSheet({ p, familyId, choice, onClose }: { p: Patient; familyId: string; choice: Choice | null; onClose: () => void }) {
  const { t, money } = useT();
  const outcomeSetting = useDemo((s) => s.data?.settings.paymentOutcome ?? "success");
  const packages = useDemo((s) => s.data?.packages) ?? [];
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [stage, setStage] = useState<"form" | "processing" | "success" | "failed">("form");
  const paySpot = useSpot<HTMLButtonElement>("family.pay");
  if (!choice) return null;
  const def = packages.find((x) => x.id === choice.kind);
  const amount = choice.kind === "monthly" ? def?.prices.month ?? 0 : def?.prices[choice.lengthDays as 7 | 14 | 30] ?? 0;
  const close = () => {
    setStage("form");
    onClose();
  };
  const submit = () => {
    setStage("processing");
    window.setTimeout(() => setStage(pay(p.id, familyId, choice.kind, choice.lengthDays, choice.purpose, method)), 1100);
  };
  return (
    <Sheet
      open
      onClose={close}
      title={t("family.plan.payTitle", { amount: money(amount) })}
      footer={
        stage === "form" ? (
          <>
            <Button onClick={close}>{t("common.cancel")}</Button>
            <Button ref={paySpot.ref} variant="primary" icon={CreditCard} onClick={submit} className={paySpot.className}>
              {t("family.plan.payButton", { amount: money(amount) })}
            </Button>
          </>
        ) : stage === "failed" ? (
          <>
            <Button onClick={close}>{t("common.close")}</Button>
            <Button variant="primary" icon={RefreshCw} onClick={() => setStage("form")}>
              {t("common.retry")}
            </Button>
          </>
        ) : stage === "success" ? (
          <Button variant="primary" onClick={close}>
            {t("common.done")}
          </Button>
        ) : undefined
      }
    >
      {stage === "form" && (
        <div className="space-y-4">
          <p className="text-lg font-semibold">{t("family.plan.payFor", { package: t(`pkg.name.${choice.kind}`), length: choice.kind === "monthly" ? t("pkg.perMonth", { price: money(amount) }) : t("pkg.length", { days: choice.lengthDays }) })}</p>
          <Segmented label={t("family.plan.payMethod")} value={method} onChange={setMethod} options={[{ value: "upi", label: t("family.plan.method.upi") }, { value: "card", label: t("family.plan.method.card") }]} />
          {method === "upi" ? (
            <Field label={t("family.plan.upiId")} htmlFor="upi">
              <Input id="upi" defaultValue={t("family.plan.upiSample")} />
            </Field>
          ) : (
            <Field label={t("family.plan.cardNumber")} htmlFor="card">
              <Input id="card" inputMode="numeric" defaultValue={t("family.plan.cardSample")} />
            </Field>
          )}
          <div className="rounded-xl border border-dashed border-line p-3">
            <p className="mb-2 text-sm font-semibold text-muted">{t("family.plan.demoOutcome")}</p>
            <Segmented
              size="sm"
              label={t("family.plan.demoOutcome")}
              value={outcomeSetting}
              onChange={setPaymentOutcome}
              options={[
                { value: "success", label: t("family.plan.succeed") },
                { value: "fail", label: t("family.plan.fail") },
              ]}
            />
          </div>
        </div>
      )}
      {stage === "processing" && (
        <div className="flex flex-col items-center gap-3 py-8" role="status">
          <Loader aria-hidden size={36} className="animate-spin text-brand" />
          <p className="font-semibold">{t("family.plan.processing")}</p>
        </div>
      )}
      {stage === "success" && (
        <Banner tone="ok" icon={CircleCheck} title={t("family.plan.successTitle")}>
          {t("family.plan.successBody", { amount: money(amount) })}
        </Banner>
      )}
      {stage === "failed" && (
        <Banner tone="danger" icon={CircleX} title={t("family.plan.failTitle")}>
          {t("family.plan.failBody")}
        </Banner>
      )}
    </Sheet>
  );
}
