"use client";

import { useMemo } from "react";
import { useRoleNav } from "@/components/shell/useRoleNav";
import type { Role } from "@/domain/types";
import { useT } from "@/i18n/useT";
import { setUi, useDemo } from "@/store/store";
import { Diagram, type DiagramRow, type NodeKind } from "./Diagram";

type Target = { role: Role; screen: string; select?: "nurse" | "doctor" };

export function FlowMap() {
  const { t } = useT();
  const navigate = useRoleNav();
  const focus = useDemo((s) => s.ui.focusPatientId);

  const rows = useMemo(() => {
    const open = (target: Target) => () => {
      if (target.select === "nurse") setUi((ui) => ({ selection: { ...ui.selection, nursePatientId: focus } }));
      if (target.select === "doctor") setUi((ui) => ({ selection: { ...ui.selection, doctorPatientId: focus } }));
      navigate(target.role, target.screen);
    };
    const n = (id: string, label: string, kind: NodeKind, target: Target) => ({ id, label, kind, onOpen: open(target) });
    const patient: Target = { role: "patient", screen: "" };
    const flags: Target = { role: "nurse", screen: "flags" };

    const journey: DiagramRow[] = [
      {
        nodes: [
          n("enrol", t("flow.j.enrol"), "step", { role: "desk", screen: "" }),
          n("verify", t("flow.j.verify"), "step", { role: "nurse", screen: "patient", select: "nurse" }),
          n("calls", t("flow.j.calls"), "say", patient),
          n("report", t("flow.j.report"), "log", { role: "family", screen: "report" }),
          n("visits", t("flow.j.visits"), "step", { role: "caregiver", screen: "" }),
          n("review", t("flow.j.review"), "step", { role: "doctor", screen: "patient", select: "doctor" }),
          n("renew", t("flow.j.renew"), "step", { role: "family", screen: "package" }),
        ],
      },
    ];

    const call: DiagramRow[] = [
      { nodes: [n("dial", t("flow.c.dial"), "step", patient), n("greet", t("flow.c.greeting"), "say", patient), n("ask", t("flow.c.ask"), "say", patient)] },
      { nodes: [n("r-na", t("flow.c.noAnswer"), "reply", patient), n("retry", t("flow.c.retry"), "step", patient), n("famflag", t("flow.c.familyFlag"), "flag", flags)] },
      { nodes: [n("r-taken", t("flow.c.taken"), "reply", patient), n("readback", t("flow.c.readBack"), "say", patient), n("yes", `${t("flow.c.yes")}: ${t("flow.c.logged")}`, "log", { role: "family", screen: "report" })] },
      { nodes: [n("r-no", `${t("flow.c.readBack")} → ${t("flow.c.no")}`, "reply", patient), n("askonce", t("flow.c.askOnce"), "say", patient)] },
      { nodes: [n("r-later", t("flow.c.later"), "reply", patient), n("again", t("flow.c.callAgain"), "step", patient), n("p3", `${t("flow.c.thirdTime")}: ${t("flow.c.postponedFlag")}`, "flag", flags)] },
      { nodes: [n("r-unwell", t("flow.c.unwell"), "reply", patient), n("nurseline", t("flow.c.nurseLine"), "say", patient), n("urgent", t("flow.c.urgentFlag"), "urgent", flags)] },
      { nodes: [n("r-refuse", t("flow.c.refuse"), "reply", patient), n("note", t("flow.c.refuseNote"), "step", { role: "nurse", screen: "flags" }), n("rflag", t("flow.c.refuseFlag"), "flag", flags)] },
      { nodes: [n("r-else", t("flow.c.someoneElse"), "reply", patient), n("askwhen", t("flow.c.askWhen"), "say", patient), n("once", t("flow.c.rescheduleOnce"), "step", patient), n("wflag", t("flow.c.wrongFlag"), "flag", flags)] },
      { nodes: [n("r-unclear", t("flow.c.unclear"), "reply", patient), n("keypad", t("flow.c.keypad"), "say", patient), n("uflag", t("flow.c.stillUnclear"), "flag", flags)] },
      { nodes: [n("eod", t("flow.c.endOfDay"), "log", { role: "family", screen: "" })] },
    ];
    return { journey, call };
  }, [t, navigate, focus]);

  const legend: Array<{ kind: NodeKind; label: string; fill: string; stroke: string }> = [
    { kind: "step", label: t("flow.legendStep"), fill: "var(--surface)", stroke: "var(--line)" },
    { kind: "say", label: t("flow.legendSay"), fill: "var(--info-soft)", stroke: "var(--info)" },
    { kind: "log", label: t("flow.legendLog"), fill: "var(--ok-soft)", stroke: "var(--ok)" },
    { kind: "flag", label: t("flow.legendFlag"), fill: "var(--warn-soft)", stroke: "var(--warn)" },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{t("flow.title")}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("flow.intro")}</p>
        <ul className="flex flex-wrap gap-3 pt-1" aria-label={t("flow.legend")}>
          {legend.map((l) => (
            <li key={l.kind} className="flex items-center gap-2 text-sm">
              <span aria-hidden className="inline-block h-4 w-6 rounded" style={{ background: l.fill, border: `1.5px solid ${l.stroke}` }} />
              {l.label}
            </li>
          ))}
        </ul>
      </header>
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{t("flow.journey")}</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <Diagram rows={rows.journey} label={t("flow.journey")} openLabel={t("flow.open")} />
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{t("flow.callFlow")}</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <Diagram rows={rows.call} label={t("flow.callFlow")} openLabel={t("flow.open")} />
        </div>
      </section>
    </div>
  );
}
