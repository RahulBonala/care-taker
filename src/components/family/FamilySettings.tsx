"use client";

import { Clock, Globe, LogOut, UserPlus, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Banner, Button, Card, Chip, EmptyState, Field, Input, Screen, ScreenTitle, Section, Select } from "@/components/ui";
import { callTimeFor } from "@/domain/schedule";
import { SLOTS, type Kin, type Lang, type Relation, type Slot } from "@/domain/types";
import { LANG_CODES, LANGUAGES } from "@/i18n";
import { useT } from "@/i18n/useT";
import type { HHMM } from "@/lib/time";
import { addFamilyMember, familySignOut, saveTimes, updateFamilyMember } from "@/store/roleActions";
import { useFamily } from "./useFamily";

export const TIME_ZONES = ["Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney"] as const;
const RELATIONS: Relation[] = ["son", "daughter", "husband", "wife", "brother", "sister", "grandson", "granddaughter", "daughterInLaw", "sonInLaw", "nephew", "niece"];
const KINS: Kin[] = ["mother", "father", "wife", "husband", "grandmother", "grandfather", "sister", "brother", "motherInLaw", "fatherInLaw", "aunt", "uncle"];

export function TimesEditor({ meals, calls, onSave, saveLabel }: { meals: Record<Slot, HHMM>; calls: Partial<Record<Slot, HHMM>>; onSave: (m: Record<Slot, HHMM>, c: Partial<Record<Slot, HHMM>>) => void; saveLabel: string }) {
  const { t } = useT();
  const [m, setM] = useState(meals);
  const [c, setC] = useState(calls);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(m, c);
        setSaved(true);
      }}
    >
      <p className="text-sm text-muted">{t("family.settings.timesHelp")}</p>
      <div className="divide-y divide-line rounded-2xl border border-line">
        {SLOTS.map((slot) => (
          <div key={slot} className="grid grid-cols-1 gap-2 p-3 @sm:grid-cols-[110px_1fr_1fr] @sm:items-end">
            <p className="font-bold">{t(`slot.${slot}`)}</p>
            <Field label={slot === "bedtime" ? t("slot.bedtime") : t("family.settings.meal")} htmlFor={`meal-${slot}`}>
              <Input id={`meal-${slot}`} type="time" value={m[slot]} onChange={(e) => { setSaved(false); setM({ ...m, [slot]: e.target.value }); }} />
            </Field>
            <Field label={t("family.settings.call")} htmlFor={`call-${slot}`} hint={c[slot] ? undefined : `${t("family.settings.auto")} (${callTimeFor({ mealTimes: m, callTimes: {} }, slot)})`}>
              <Input id={`call-${slot}`} type="time" value={c[slot] ?? ""} onChange={(e) => { setSaved(false); setC({ ...c, [slot]: e.target.value || undefined }); }} />
            </Field>
          </div>
        ))}
      </div>
      {saved && <Banner tone="ok">{t("family.settings.timesSaved")}</Banner>}
      <Button type="submit" variant="primary" icon={Clock}>
        {saveLabel}
      </Button>
    </form>
  );
}

export function FamilySettings() {
  const { t, text, time, person } = useT();
  const { repos, f, p, now, familyId } = useFamily();
  const [form, setForm] = useState({ name: "", relation: "daughter" as Relation, kin: "mother" as Kin, phone: "", timeZone: "Asia/Kolkata", reportLanguage: "en" as Lang });
  const [error, setError] = useState("");
  const [added, setAdded] = useState(false);
  if (!f || !p) return <Screen><EmptyState title={t("common.notAllowed")} /></Screen>;
  const members = repos.family.forPatient(p.id);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t("family.settings.nameNeeded"));
    if (form.phone.replace(/\D/g, "").length < 8) return setError(t("family.settings.phoneNeeded"));
    setError("");
    addFamilyMember(familyId, { patientId: p.id, name: { en: form.name.trim() }, relation: form.relation, kin: form.kin, phone: form.phone.trim(), city: { en: "" }, timeZone: form.timeZone, reportLanguage: form.reportLanguage });
    setAdded(true);
    setForm({ ...form, name: "", phone: "" });
  };

  return (
    <Screen>
      <ScreenTitle title={t("family.settings.title")} subtitle={person(p.id)} />

      <Section title={t("family.settings.times")} icon={Clock}>
        <Card>
          <TimesEditor key={JSON.stringify(p.mealTimes) + JSON.stringify(p.callTimes)} meals={p.mealTimes} calls={p.callTimes} onSave={(m, c) => saveTimes(p.id, familyId, "family", m, c)} saveLabel={t("family.settings.saveTimes")} />
        </Card>
      </Section>

      <Section title={t("family.settings.timeZone")} icon={Globe}>
        <Card className="space-y-4">
          <Field label={t("family.settings.timeZone")} htmlFor="tz" hint={t("family.settings.timeZoneHelp")}>
            <Select id="tz" value={f.timeZone} onChange={(e) => updateFamilyMember(familyId, { timeZone: e.target.value })}>
              {TIME_ZONES.map((z) => (
                <option key={z} value={z}>
                  {t(`tz.${z}`)}
                </option>
              ))}
            </Select>
          </Field>
          <p className="font-semibold">{t("family.settings.nowHere", { there: time(now, f.timeZone), here: time(now) })}</p>
          <Field label={t("family.settings.reportLanguage")} htmlFor="rl">
            <Select id="rl" value={f.reportLanguage} onChange={(e) => updateFamilyMember(familyId, { reportLanguage: e.target.value as Lang })}>
              {LANG_CODES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGES[l].nativeName} · {t(`lang.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
      </Section>

      <Section title={t("family.settings.members")} icon={Users}>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id}>
              <Card className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{text(m.name)}</p>
                  <p className="text-sm text-muted">
                    {t(`relation.${m.relation}`)} · {m.phone} · {t(`tz.${m.timeZone}` as "tz.Asia/Kolkata")}
                  </p>
                </div>
                {m.primary && <Chip tone="brand" size="sm">{t("family.settings.primary")}</Chip>}
              </Card>
            </li>
          ))}
        </ul>
        <Card>
          <form onSubmit={add} className="space-y-3" noValidate>
            <h3 className="flex items-center gap-2 font-bold">
              <UserPlus aria-hidden size={18} />
              {t("family.settings.addMember")}
            </h3>
            <div className="grid gap-3 @md:grid-cols-2">
              <Field label={t("family.settings.memberName")} htmlFor="m-name">
                <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </Field>
              <Field label={t("family.settings.phone")} htmlFor="m-phone">
                <Input id="m-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label={t("family.settings.relation")} htmlFor="m-rel">
                <Select id="m-rel" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value as Relation })}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`relation.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("family.settings.kin")} htmlFor="m-kin">
                <Select id="m-kin" value={form.kin} onChange={(e) => setForm({ ...form, kin: e.target.value as Kin })}>
                  {KINS.map((k) => (
                    <option key={k} value={k}>
                      {t(`kin.${k}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("family.settings.timeZone")} htmlFor="m-tz">
                <Select id="m-tz" value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })}>
                  {TIME_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {t(`tz.${z}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("family.settings.reportLanguage")} htmlFor="m-lang">
                <Select id="m-lang" value={form.reportLanguage} onChange={(e) => setForm({ ...form, reportLanguage: e.target.value as Lang })}>
                  {LANG_CODES.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGES[l].nativeName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {error && <p className="font-semibold text-danger" role="alert">{error}</p>}
            {added && !error && <Banner tone="ok">{t("family.settings.added")}</Banner>}
            <Button type="submit" variant="primary" icon={UserPlus}>
              {t("family.settings.addMember")}
            </Button>
          </form>
        </Card>
      </Section>

      <Button variant="ghost" icon={LogOut} onClick={() => familySignOut(familyId)}>
        {t("family.settings.signOut")}
      </Button>
    </Screen>
  );
}
