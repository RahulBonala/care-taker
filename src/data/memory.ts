import type { DemoData } from "@/domain/data";
import { DoseBook, replacedIds } from "@/domain/doses";
import { priceOf } from "@/domain/packages";
import type { Patient, Role } from "@/domain/types";
import type { Repos, Viewer } from "./repos";

const digits = (s: string) => s.replace(/\D/g, "");

/** Which patients a viewer may see. */
function visiblePatientIds(data: DemoData, v: Viewer): Set<string> | "all" {
  switch (v.role) {
    case "nurse":
    case "admin":
    case "desk":
      return "all";
    case "doctor":
      return new Set(data.patients.filter((p) => p.doctorId === v.userId).map((p) => p.id));
    case "family": {
      const f = data.family.find((x) => x.id === v.userId);
      return new Set(f ? [f.patientId] : []);
    }
    case "patient":
      return new Set([v.userId]);
    case "caregiver":
      return new Set(data.visits.filter((x) => x.caregiverId === v.userId).map((x) => x.patientId));
  }
}

/** The desk handles enrolment only: no medicines, no clinical detail. */
function deskView(p: Patient): Patient {
  return { ...p, prescriptions: p.prescriptions.map((rx) => ({ ...rx, medicines: [] })), baseline: {} };
}

const CLINICAL: Role[] = ["patient", "family", "nurse", "caregiver", "doctor", "admin"];

export function createRepos(data: DemoData, viewer: Viewer): Repos {
  const ids = visiblePatientIds(data, viewer);
  const sees = (pid: string) => ids === "all" || ids.has(pid);
  const clinical = CLINICAL.includes(viewer.role);
  const payments = viewer.role === "family" || viewer.role === "admin";
  const familyContacts = viewer.role !== "caregiver";
  const shape = (p: Patient) => (viewer.role === "desk" ? deskView(p) : p);
  const patients = data.patients.filter((p) => sees(p.id)).map(shape);
  const replaced = replacedIds(data.log);

  return {
    viewer,
    can: { clinical, payments, familyContacts, audit: viewer.role === "admin" },
    patients: {
      list: () => patients,
      get: (id) => patients.find((p) => p.id === id),
      search: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return patients;
        const qd = digits(q);
        return patients.filter((p) => {
          const names = [p.name.en, p.name.hi, p.name.te].filter(Boolean).map((n) => n!.toLowerCase());
          return names.some((n) => n.includes(q)) || (qd.length >= 3 && digits(p.phone).includes(qd));
        });
      },
    },
    family: {
      forPatient: (pid) => (familyContacts && sees(pid) ? data.family.filter((f) => f.patientId === pid) : []),
      get: (id) => (familyContacts ? data.family.find((f) => f.id === id && sees(f.patientId)) : undefined),
      all: () => (familyContacts ? data.family.filter((f) => sees(f.patientId)) : []),
    },
    staff: {
      list: (role) => data.staff.filter((s) => !role || s.role === role),
      get: (id) => data.staff.find((s) => s.id === id),
    },
    calls: {
      forPatient: (pid, date) => (clinical && sees(pid) ? data.calls.filter((c) => c.patientId === pid && (!date || c.date === date)) : []),
      get: (id) => (clinical ? data.calls.find((c) => c.id === id && sees(c.patientId)) : undefined),
      queued: (pid) => (clinical && sees(pid) ? data.queue.filter((q) => q.patientId === pid).sort((a, b) => a.at - b.at) : []),
      all: () => (clinical ? data.calls.filter((c) => sees(c.patientId)) : []),
      ringing: () => data.calls.find((c) => c.id === data.phone.ringingCallId),
      active: () => data.calls.find((c) => c.id === data.phone.activeCallId),
    },
    log: {
      forPatient: (pid) => (clinical && sees(pid) ? data.log.filter((e) => e.patientId === pid) : []),
      get: (id) => (clinical ? data.log.find((e) => e.id === id && sees(e.patientId)) : undefined),
      replaced: () => replaced,
    },
    flags: {
      open: () => (clinical ? data.flags.filter((f) => f.status !== "closed" && sees(f.patientId)) : []),
      all: () => (clinical ? data.flags.filter((f) => sees(f.patientId)) : []),
      forPatient: (pid) => (clinical && sees(pid) ? data.flags.filter((f) => f.patientId === pid) : []),
      get: (id) => (clinical ? data.flags.find((f) => f.id === id && sees(f.patientId)) : undefined),
    },
    visits: {
      forPatient: (pid) => (sees(pid) && viewer.role !== "desk" ? data.visits.filter((v) => v.patientId === pid) : []),
      forCaregiver: (cid) => data.visits.filter((v) => v.caregiverId === cid && sees(v.patientId)),
      all: () => (viewer.role === "desk" ? [] : data.visits.filter((v) => sees(v.patientId))),
      get: (id) => data.visits.find((v) => v.id === id && sees(v.patientId)),
    },
    reports: {
      forPatient: (pid) => (clinical && sees(pid) ? data.reports.filter((r) => r.patientId === pid) : []),
      get: (id) => (clinical ? data.reports.find((r) => r.id === id && sees(r.patientId)) : undefined),
      all: () => (clinical ? data.reports.filter((r) => sees(r.patientId)) : []),
    },
    messages: {
      forFamily: (fid) => (viewer.role === "family" && viewer.userId === fid) || viewer.role === "admin" ? data.messages.filter((m) => m.familyId === fid) : [],
    },
    payments: {
      forPatient: (pid) => (payments && sees(pid) ? data.payments.filter((p) => p.patientId === pid) : []),
      all: () => (payments ? data.payments.filter((p) => sees(p.patientId)) : []),
    },
    packages: {
      list: () => data.packages,
      price: (kind, length) => priceOf(data.packages, kind, length),
    },
    audit: {
      list: () => (viewer.role === "admin" ? data.audit : []),
    },
    events: {
      list: () => data.events,
    },
    doses: new DoseBook(data),
  };
}
