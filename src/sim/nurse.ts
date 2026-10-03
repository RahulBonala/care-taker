import type { DemoData } from "@/domain/data";
import { findPatient, nextId } from "@/domain/data";
import { effectiveDoseIndex } from "@/domain/doses";
import type { Flag, FlagType, LocalText } from "@/domain/types";
import { audit, emit, messageFamily } from "./emit";

export function startFlagCall(data: DemoData, flag: Flag, at: number, by: string) {
  flag.status = "calling";
  flag.calledAt = at;
  flag.calledBy = by;
  const family = flag.type === "familyCallback";
  emit(
    data,
    at,
    family ? "event.nurseCallingFamily" : "event.nurseCalling",
    { person: { $person: by }, patient: { $person: flag.patientId } },
    ["nurse", "family", "admin"],
    "info",
    flag.patientId,
  );
  audit(data, at, by, "nurse", "changed", flag.id, "audit.flagCalling", { patient: { $person: flag.patientId }, flag: { $t: `flag.type.${flag.type}` } }, flag.patientId);
}

export interface CloseFlagInput {
  outcome: LocalText;
  spoke: boolean;
  /** The patient confirmed the dose to the nurse on the call (a person did the read-back). */
  doseTaken?: boolean;
  role?: "nurse" | "admin";
}

export function closeFlag(data: DemoData, flag: Flag, at: number, by: string, input: CloseFlagInput) {
  flag.status = "closed";
  flag.closedAt = at;
  flag.closedBy = by;
  flag.outcome = input.outcome;
  flag.spokeToPatient = input.spoke;
  const pid = flag.patientId;
  const role = input.role ?? "nurse";
  if (role === "nurse") {
    data.log.push({ id: nextId(data, "l"), kind: "nurseNote", patientId: pid, at, source: "nurse", by, text: input.outcome, flagId: flag.id, spokeToPatient: input.spoke && flag.type !== "familyCallback" });
  }
  if (input.doseTaken && flag.date && flag.slot) {
    const existing = effectiveDoseIndex(data.log).get(`${pid}|${flag.date}|${flag.slot}`);
    if (!existing || existing.kind === "doseMissed") {
      data.log.push({
        id: nextId(data, "l"),
        kind: "doseTaken",
        patientId: pid,
        at,
        source: "nurse",
        by,
        date: flag.date,
        slot: flag.slot,
        takenAt: at,
        confirmation: "nurseCall",
        replaces: existing?.id,
      });
      emit(data, at, "event.logWritten", { patient: { $person: pid }, slot: { $t: `slotWord.${flag.slot}` } }, ["family", "nurse", "doctor", "admin"], "ok", pid);
    }
  }
  emit(data, at, "event.flagClosed", { flag: { $t: `flag.type.${flag.type}` }, patient: { $person: pid }, person: { $person: by } }, ["nurse", "admin"], "ok", pid);
  if (input.spoke && role === "nurse") {
    const kind = flag.type === "familyCallback" ? "event.nurseCalledFamily" : "event.nurseSpoke";
    if (flag.type !== "familyCallback") messageFamily(data, at, pid, "nurseSpoke", { patient: { $person: pid }, person: { $person: by } });
    emit(data, at, kind, { patient: { $person: pid }, person: { $person: by } }, ["family", "nurse", "admin"], "ok", pid);
  }
  audit(data, at, by, role, "closed", flag.id, "audit.flagClosed", { patient: { $person: pid }, flag: { $t: `flag.type.${flag.type}` } }, pid);
}

/** Outcome notes the sample nurses wrote for flags in the seeded history. */
export const SAMPLE_OUTCOMES: Partial<Record<FlagType, LocalText>> = {
  unwell: {
    en: "Spoke to the patient. Felt tired in the morning and is resting at home. Informed the treating doctor.",
    hi: "मरीज़ से बात की। सुबह थकान लग रही थी, घर पर आराम कर रहे हैं। इलाज करने वाले डॉक्टर को बता दिया।",
    te: "రోగితో మాట్లాడాను. ఉదయం అలసటగా ఉందన్నారు, ఇంట్లో విశ్రాంతి తీసుకుంటున్నారు. చికిత్స చేసే డాక్టర్‌కు తెలియజేశాను.",
  },
  personRequested: {
    en: "Called back. Wanted to know the time of the next visit. Told them.",
    hi: "वापस फ़ोन किया। अगली विज़िट का समय जानना था। बता दिया।",
    te: "తిరిగి ఫోన్ చేశాను. తదుపరి సందర్శన సమయం తెలుసుకోవాలనుకున్నారు. చెప్పాను.",
  },
  noAnswer: {
    en: "Reached the family. The patient was at a relative's house. Calls continue as planned.",
    hi: "परिवार से बात हुई। मरीज़ रिश्तेदार के घर गए थे। कॉल पहले की तरह चलेंगी।",
    te: "కుటుంబంతో మాట్లాడాను. రోగి బంధువుల ఇంటికి వెళ్ళారు. కాల్స్ యథావిధిగా కొనసాగుతాయి.",
  },
  postponed3: {
    en: "Called the patient. Lunch was late today. Updated the family about the call times.",
    hi: "मरीज़ को फ़ोन किया। आज खाना देर से बना। परिवार को कॉल के समय के बारे में बताया।",
    te: "రోగికి ఫోన్ చేశాను. ఈరోజు భోజనం ఆలస్యమైంది. కాల్ సమయాల గురించి కుటుంబానికి చెప్పాను.",
  },
  unclear: {
    en: "Called the patient. The line was noisy. They are getting the calls and can press the keys.",
    hi: "मरीज़ को फ़ोन किया। लाइन में शोर था। उन्हें कॉल मिल रही हैं और वे बटन दबा सकते हैं।",
    te: "రోగికి ఫోన్ చేశాను. లైన్‌లో శబ్దం ఉంది. వారికి కాల్స్ వస్తున్నాయి, బటన్లు నొక్కగలరు.",
  },
  refused: {
    en: "Spoke to the patient and their son. Shared with the treating doctor for review.",
    hi: "मरीज़ और उनके बेटे से बात की। डॉक्टर को समीक्षा के लिए बताया।",
    te: "రోగితో, వారి కొడుకుతో మాట్లాడాను. సమీక్ష కోసం డాక్టర్‌కు తెలియజేశాను.",
  },
  wrongPerson: {
    en: "Spoke to the family. Noted the best time to reach the patient.",
    hi: "परिवार से बात की। मरीज़ से बात करने का सही समय नोट किया।",
    te: "కుటుంబంతో మాట్లాడాను. రోగిని కలవడానికి సరైన సమయం నమోదు చేశాను.",
  },
  pillMismatch: {
    en: "Called the patient. Two tablets were kept in another box. Counted again together.",
    hi: "मरीज़ को फ़ोन किया। दो गोलियाँ दूसरे डिब्बे में रखी थीं। साथ में दोबारा गिनीं।",
    te: "రోగికి ఫోన్ చేశాను. రెండు మాత్రలు వేరే డబ్బాలో ఉన్నాయి. కలిసి మళ్ళీ లెక్కపెట్టాము.",
  },
  caregiverNoShow: {
    en: "The caregiver's scooter broke down. Visit moved to the next morning. Family informed.",
    hi: "देखभालकर्ता का स्कूटर ख़राब हो गया था। विज़िट अगली सुबह रखी। परिवार को बताया।",
    te: "సంరక్షకుడి స్కూటర్ పాడైంది. సందర్శనను మరుసటి ఉదయానికి మార్చాము. కుటుంబానికి తెలియజేశాము.",
  },
  reportCheckFailed: {
    en: "Checked the report against the log. The wrong number was removed and the report was sent again.",
    hi: "रिपोर्ट को लॉग से मिलाया। गलत संख्या हटाई और रिपोर्ट दोबारा भेजी।",
    te: "నివేదికను లాగ్‌తో సరిచూశాను. తప్పు సంఖ్యను తీసివేసి నివేదికను మళ్ళీ పంపాము.",
  },
  familyCallback: {
    en: "Called the family member back and answered their questions about the visit schedule.",
    hi: "परिवार के सदस्य को वापस फ़ोन किया और विज़िट के समय के बारे में उनके सवालों के जवाब दिए।",
    te: "కుటుంబ సభ్యుడికి తిరిగి ఫోన్ చేసి, సందర్శన సమయాల గురించి వారి ప్రశ్నలకు సమాధానం ఇచ్చాను.",
  },
};

/** Seed helper: the patient's nurse (or the admin) handles an old flag. */
export function nurseHandles(data: DemoData, flag: Flag, at: number) {
  const p = findPatient(data, flag.patientId);
  const outcome = SAMPLE_OUTCOMES[flag.type] ?? SAMPLE_OUTCOMES.unwell!;
  if (flag.urgency === "admin") {
    closeFlag(data, flag, at, "a_deepak", { outcome, spoke: false, role: "admin" });
    return;
  }
  const by = p?.nurseId ?? "n_mary";
  startFlagCall(data, flag, at - 10 * 60_000, by);
  closeFlag(data, flag, at, by, { outcome, spoke: true });
}
