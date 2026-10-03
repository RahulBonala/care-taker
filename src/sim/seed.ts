/**
 * Sample data. Every person, phone number and address here is made up.
 * History is not typed in: each patient is enrolled on their start date and
 * the clock is run forward to the demo start, so calls, logs, visits,
 * reports, flags and the audit trail all agree with each other.
 */
import type { DemoData } from "@/domain/data";
import { DEFAULT_PACKAGES, endDateFor } from "@/domain/packages";
import { DEFAULT_MEAL_TIMES } from "@/domain/schedule";
import type {
  CallInput,
  FamilyMember,
  Hospital,
  LocalText,
  Medicine,
  PackageKind,
  Patient,
  Slot,
  StaffUser,
  VisitTask,
  Vitals,
} from "@/domain/types";
import { defaultPattern, planVisits } from "@/domain/visits";
import { addDays, atLocal, type HHMM, type LocalDate, MIN } from "@/lib/time";
import { advanceClock } from "./advance";
import { SCRIPTS } from "./behaviour";
import { ensureDayCalls } from "./day";
import { audit, emit } from "./emit";

/** Explore mode starts here: Monday 5 October 2026, 12:50 pm (India). */
export const EXPLORE_START = atLocal("2026-10-05", "12:50");
/** Story mode starts at Mrs Lakshmi Devi's discharge, 10:30 am the same day. */
export const STORY_START = atLocal("2026-10-05", "10:30");
export const DEMO_TODAY: LocalDate = "2026-10-05";

export const HOSPITAL: Hospital = {
  id: "h_city",
  name: { en: "City Care Hospital, demo", hi: "सिटी केयर हॉस्पिटल, डेमो", te: "సిటీ కేర్ హాస్పిటల్, డెమో" },
  city: { en: "Hyderabad", hi: "हैदराबाद", te: "హైదరాబాద్" },
  phone: "+91 40 4000 1000",
};

const t = (en: string, hi: string, te: string): LocalText => ({ en, hi, te });

export const STAFF: StaffUser[] = [
  { id: "d_anjali", role: "doctor", honorific: "dr", name: t("Anjali Rao", "अंजलि राव", "అంజలి రావు"), phone: "+91 90000 00201", hospitalId: HOSPITAL.id, speciality: t("Orthopaedics", "हड्डी रोग", "ఎముకల వైద్యం") },
  { id: "d_vikram", role: "doctor", honorific: "dr", name: t("Vikram Sharma", "विक्रम शर्मा", "విక్రమ్ శర్మ"), phone: "+91 90000 00202", hospitalId: HOSPITAL.id, speciality: t("General medicine and cardiology", "सामान्य चिकित्सा और हृदय रोग", "జనరల్ మెడిసిన్, గుండె వైద్యం") },
  { id: "n_mary", role: "nurse", honorific: "none", name: t("Mary Joseph", "मैरी जोसेफ़", "మేరీ జోసెఫ్"), phone: "+91 90000 00301", hospitalId: HOSPITAL.id },
  { id: "n_kavitha", role: "nurse", honorific: "none", name: t("Kavitha Nair", "कविता नायर", "కవిత నాయర్"), phone: "+91 90000 00302", hospitalId: HOSPITAL.id },
  {
    id: "c_suresh", role: "caregiver", honorific: "none", name: t("Suresh Babu", "सुरेश बाबू", "సురేష్ బాబు"), phone: "+91 90000 00401", hospitalId: HOSPITAL.id,
    caregiver: { verified: true, trainings: ["vitals", "pillCount", "woundCare", "mobility", "privacy", "emergency"], area: t("Malkajgiri", "मलकाजगिरी", "మల్కాజిగిరి"), visitsThisMonth: 38, earningsThisMonth: 15200 },
  },
  {
    id: "c_meena", role: "caregiver", honorific: "none", name: t("Meena Kumari", "मीना कुमारी", "మీనా కుమారి"), phone: "+91 90000 00402", hospitalId: HOSPITAL.id,
    caregiver: { verified: true, trainings: ["vitals", "pillCount", "privacy", "emergency"], area: t("Begumpet", "बेगमपेट", "బేగంపేట"), visitsThisMonth: 44, earningsThisMonth: 17600 },
  },
  {
    id: "c_rajesh", role: "caregiver", honorific: "none", name: t("Rajesh Yadav", "राजेश यादव", "రాజేష్ యాదవ్"), phone: "+91 90000 00403", hospitalId: HOSPITAL.id,
    caregiver: { verified: true, trainings: ["vitals", "pillCount", "mobility", "privacy"], area: t("Tolichowki", "टोलीचौकी", "టోలిచౌకి"), visitsThisMonth: 29, earningsThisMonth: 11600 },
  },
  {
    id: "c_asha", role: "caregiver", honorific: "none", name: t("Asha Verma", "आशा वर्मा", "ఆశా వర్మ"), phone: "+91 90000 00404", hospitalId: HOSPITAL.id,
    caregiver: { verified: false, trainings: ["vitals", "privacy"], area: t("Kondapur", "कोंडापुर", "కొండాపూర్"), visitsThisMonth: 0, earningsThisMonth: 0 },
  },
  { id: "k_neha", role: "desk", honorific: "none", name: t("Neha Kapoor", "नेहा कपूर", "నేహా కపూర్"), phone: "+91 90000 00501", hospitalId: HOSPITAL.id },
  { id: "k_farhan", role: "desk", honorific: "none", name: t("Farhan Ali", "फ़रहान अली", "ఫర్హాన్ అలీ"), phone: "+91 90000 00502", hospitalId: HOSPITAL.id },
  { id: "a_deepak", role: "admin", honorific: "none", name: t("Deepak Menon", "दीपक मेनन", "దీపక్ మీనన్"), phone: "+91 90000 00601", hospitalId: HOSPITAL.id },
];

interface PatientSeed {
  id: string;
  name: LocalText;
  honorific: Patient["honorific"];
  gender: Patient["gender"];
  age: number;
  phone: string;
  sharesPhoneWith?: string;
  language: Patient["language"];
  phoneType: Patient["phoneType"];
  condition: LocalText;
  doctorId: string;
  nurseId: string;
  address: LocalText;
  distanceKm: number;
  meals: Partial<Record<Slot, HHMM>>;
  start: LocalDate;
  /** Calls start this long after 10:00 am on the start day (nurse verification). */
  kind: PackageKind;
  lengthDays: number;
  monthNo?: number;
  caregiverId?: string;
  tasks?: VisitTask[];
  visitStart?: HHMM;
  meds: Array<Omit<Medicine, "id" | "startDate" | "endDate"> & { days?: number }>;
  hue: number;
  baseline: Vitals;
  review?: number;
  enrolledBy: string;
}

export const LAKSHMI_ID = "p_lakshmi";

const PATIENTS: PatientSeed[] = [
  {
    id: LAKSHMI_ID,
    name: t("Lakshmi Devi", "लक्ष्मी देवी", "లక్ష్మీ దేవి"),
    honorific: "mrs",
    gender: "f",
    age: 67,
    phone: "+91 90000 00101",
    language: "te",
    phoneType: "keypad",
    condition: t("After knee replacement", "घुटना बदलने के ऑपरेशन के बाद", "మోకాలి మార్పిడి శస్త్రచికిత్స తర్వాత"),
    doctorId: "d_anjali",
    nurseId: "n_mary",
    address: t("12-3-45, Street 4, Malkajgiri, Hyderabad", "12-3-45, गली 4, मलकाजगिरी, हैदराबाद", "12-3-45, వీధి 4, మల్కాజిగిరి, హైదరాబాద్"),
    distanceKm: 3.2,
    meals: { breakfast: "08:00", lunch: "13:00", dinner: "19:00" },
    start: "2026-10-03",
    kind: "callVisit",
    lengthDays: 14,
    caregiverId: "c_suresh",
    tasks: ["vitals", "pillCount", "wound", "mobility"],
    visitStart: "16:00",
    meds: [
      { name: "Paracetamol", dose: "650 mg", perDose: 1, slots: ["breakfast", "lunch", "dinner"], food: "after", dispensed: 30, days: 10 },
      { name: "Pantoprazole", dose: "40 mg", perDose: 1, slots: ["breakfast"], food: "before", dispensed: 14 },
      { name: "Calcium with vitamin D3", dose: "500 mg", perDose: 1, slots: ["lunch"], food: "after", dispensed: 14 },
      { name: "Aspirin", dose: "75 mg", perDose: 1, slots: ["dinner"], food: "after", dispensed: 14 },
    ],
    hue: 18,
    baseline: { bpSys: 134, bpDia: 84, pulse: 78, tempC: 36.8, spo2: 97 },
    review: 9,
    enrolledBy: "k_neha",
  },
  {
    id: "p_ramesh",
    name: t("Ramesh Gupta", "रमेश गुप्ता", "రమేష్ గుప్తా"),
    honorific: "mr",
    gender: "m",
    age: 61,
    phone: "+91 90000 00102",
    language: "hi",
    phoneType: "smartphone",
    condition: t("After a heart procedure (angioplasty)", "दिल की प्रक्रिया (एंजियोप्लास्टी) के बाद", "గుండె చికిత్స (యాంజియోప్లాస్టీ) తర్వాత"),
    doctorId: "d_vikram",
    nurseId: "n_kavitha",
    address: t("Flat 302, Green Park Apartments, Begumpet, Hyderabad", "फ़्लैट 302, ग्रीन पार्क अपार्टमेंट्स, बेगमपेट, हैदराबाद", "ఫ్లాట్ 302, గ్రీన్ పార్క్ అపార్ట్‌మెంట్స్, బేగంపేట, హైదరాబాద్"),
    distanceKm: 5.8,
    meals: { breakfast: "08:30", lunch: "13:30", dinner: "20:30", bedtime: "22:30" },
    start: "2026-09-27",
    kind: "full",
    lengthDays: 14,
    caregiverId: "c_meena",
    tasks: ["vitals", "pillCount"],
    visitStart: "10:00",
    meds: [
      { name: "Clopidogrel", dose: "75 mg", perDose: 1, slots: ["breakfast"], food: "after", dispensed: 14 },
      { name: "Pantoprazole", dose: "40 mg", perDose: 1, slots: ["breakfast"], food: "before", dispensed: 14 },
      { name: "Metoprolol", dose: "25 mg", perDose: 1, slots: ["breakfast", "dinner"], food: "after", dispensed: 28 },
      { name: "Aspirin", dose: "75 mg", perDose: 1, slots: ["lunch"], food: "after", dispensed: 14 },
      { name: "Atorvastatin", dose: "40 mg", perDose: 1, slots: ["bedtime"], food: "after", dispensed: 14 },
    ],
    hue: 205,
    baseline: { bpSys: 126, bpDia: 80, pulse: 70, tempC: 36.7, spo2: 98 },
    review: 12,
    enrolledBy: "k_farhan",
  },
  {
    id: "p_fatima",
    name: t("Fatima Begum", "फ़ातिमा बेगम", "ఫాతిమా బేగం"),
    honorific: "mrs",
    gender: "f",
    age: 72,
    phone: "+91 90000 00103",
    sharesPhoneWith: "p_abdul",
    language: "hi",
    phoneType: "keypad",
    condition: t("After hip fracture surgery", "कूल्हे की हड्डी के ऑपरेशन के बाद", "తుంటి ఎముక శస్త్రచికిత్స తర్వాత"),
    doctorId: "d_anjali",
    nurseId: "n_mary",
    address: t("House 8, Lane 2, Tolichowki, Hyderabad", "मकान 8, गली 2, टोलीचौकी, हैदराबाद", "ఇల్లు 8, సందు 2, టోలిచౌకి, హైదరాబాద్"),
    distanceKm: 7.4,
    meals: { breakfast: "08:00", snack: "16:30", dinner: "19:30" },
    start: "2026-10-01",
    kind: "callVisit",
    lengthDays: 14,
    caregiverId: "c_rajesh",
    tasks: ["vitals", "pillCount", "mobility", "sugar"],
    visitStart: "11:00",
    meds: [
      { name: "Paracetamol", dose: "500 mg", perDose: 1, slots: ["breakfast", "dinner"], food: "after", dispensed: 20, days: 10 },
      { name: "Vitamin B12", dose: "500 mcg", perDose: 1, slots: ["breakfast"], food: "after", dispensed: 14 },
      { name: "Calcium with vitamin D3", dose: "500 mg", perDose: 1, slots: ["snack"], food: "after", dispensed: 14 },
    ],
    hue: 290,
    baseline: { bpSys: 140, bpDia: 86, pulse: 82, tempC: 36.9, spo2: 96, sugar: 138 },
    review: 10,
    enrolledBy: "k_neha",
  },
  {
    id: "p_abdul",
    name: t("Abdul Kareem", "अब्दुल करीम", "అబ్దుల్ కరీం"),
    honorific: "mr",
    gender: "m",
    age: 76,
    phone: "+91 90000 00103",
    sharesPhoneWith: "p_fatima",
    language: "hi",
    phoneType: "keypad",
    condition: t("After treatment for pneumonia", "निमोनिया के इलाज के बाद", "న్యుమోనియా చికిత్స తర్వాత"),
    doctorId: "d_vikram",
    nurseId: "n_kavitha",
    address: t("House 8, Lane 2, Tolichowki, Hyderabad", "मकान 8, गली 2, टोलीचौकी, हैदराबाद", "ఇల్లు 8, సందు 2, టోలిచౌకి, హైదరాబాద్"),
    distanceKm: 7.4,
    meals: { breakfast: "08:15", lunch: "13:15", dinner: "19:45", bedtime: "22:00" },
    start: "2026-10-02",
    kind: "call",
    lengthDays: 7,
    meds: [
      { name: "Amoxicillin", dose: "500 mg", perDose: 1, slots: ["breakfast", "lunch", "dinner"], food: "after", dispensed: 21 },
      { name: "Montelukast", dose: "10 mg", perDose: 1, slots: ["bedtime"], food: "after", dispensed: 7 },
    ],
    hue: 140,
    baseline: { bpSys: 130, bpDia: 78, pulse: 84, tempC: 37.0, spo2: 95 },
    review: 7,
    enrolledBy: "k_farhan",
  },
  {
    id: "p_thomas",
    name: t("Thomas Mathew", "थॉमस मैथ्यू", "థామస్ మాథ్యూ"),
    honorific: "mr",
    gender: "m",
    age: 69,
    phone: "+91 90000 00104",
    language: "en",
    phoneType: "smartphone",
    condition: t("Long-term care after a stroke", "स्ट्रोक के बाद लंबी देखभाल", "పక్షవాతం తర్వాత దీర్ఘకాల సంరక్షణ"),
    doctorId: "d_vikram",
    nurseId: "n_kavitha",
    address: t("Villa 21, Lake View Colony, Kondapur, Hyderabad", "विला 21, लेक व्यू कॉलोनी, कोंडापुर, हैदराबाद", "విల్లా 21, లేక్ వ్యూ కాలనీ, కొండాపూర్, హైదరాబాద్"),
    distanceKm: 11.0,
    meals: { breakfast: "07:30", lunch: "12:30", dinner: "19:30", bedtime: "21:30" },
    start: "2026-09-24",
    kind: "monthly",
    lengthDays: 30,
    monthNo: 3,
    meds: [
      { name: "Metformin", dose: "500 mg", perDose: 1, slots: ["breakfast", "dinner"], food: "after", dispensed: 60, days: 120 },
      { name: "Amlodipine", dose: "5 mg", perDose: 1, slots: ["breakfast"], food: "after", dispensed: 30, days: 120 },
      { name: "Aspirin", dose: "75 mg", perDose: 1, slots: ["lunch"], food: "after", dispensed: 30, days: 120 },
      { name: "Atorvastatin", dose: "20 mg", perDose: 1, slots: ["bedtime"], food: "after", dispensed: 30, days: 120 },
    ],
    hue: 45,
    baseline: { bpSys: 138, bpDia: 82, pulse: 74, tempC: 36.6, spo2: 97, sugar: 150 },
    review: 18,
    enrolledBy: "k_neha",
  },
  {
    id: "p_sarala",
    name: t("Sarala Reddy", "सरला रेड्डी", "సరళ రెడ్డి"),
    honorific: "mrs",
    gender: "f",
    age: 58,
    phone: "+91 90000 00105",
    language: "te",
    phoneType: "smartphone",
    condition: t("After gallbladder surgery", "पित्ताशय के ऑपरेशन के बाद", "పిత్తాశయ శస్త్రచికిత్స తర్వాత"),
    doctorId: "d_anjali",
    nurseId: "n_mary",
    address: t("5-9-11, Gandhi Nagar, Secunderabad", "5-9-11, गांधी नगर, सिकंदराबाद", "5-9-11, గాంధీ నగర్, సికింద్రాబాద్"),
    distanceKm: 4.1,
    meals: { breakfast: "08:30", lunch: "13:30", dinner: "20:00" },
    start: "2026-09-23",
    kind: "call",
    lengthDays: 14,
    meds: [
      { name: "Paracetamol", dose: "650 mg", perDose: 1, slots: ["breakfast", "dinner"], food: "after", dispensed: 20, days: 10 },
      { name: "Pantoprazole", dose: "40 mg", perDose: 1, slots: ["breakfast"], food: "before", dispensed: 14 },
      { name: "Ursodeoxycholic acid", dose: "300 mg", perDose: 1, slots: ["lunch", "dinner"], food: "after", dispensed: 28 },
    ],
    hue: 330,
    baseline: { bpSys: 122, bpDia: 78, pulse: 76, tempC: 36.7, spo2: 98 },
    review: 16,
    enrolledBy: "k_farhan",
  },
];

export const FAMILY: FamilyMember[] = [
  { id: "f_ravi", patientId: LAKSHMI_ID, name: t("Ravi Kumar", "रवि कुमार", "రవి కుమార్"), relation: "son", kin: "mother", phone: "+1 201 555 0142", city: t("New Jersey, United States", "न्यू जर्सी, अमेरिका", "న్యూ జెర్సీ, అమెరికా"), timeZone: "America/New_York", reportLanguage: "en", primary: true },
  { id: "f_priya", patientId: "p_ramesh", name: t("Priya Gupta", "प्रिया गुप्ता", "ప్రియా గుప్తా"), relation: "daughter", kin: "father", phone: "+91 90000 00702", city: t("Bengaluru", "बेंगलुरु", "బెంగళూరు"), timeZone: "Asia/Kolkata", reportLanguage: "hi", primary: true },
  { id: "f_imran", patientId: "p_fatima", name: t("Imran Kareem", "इमरान करीम", "ఇమ్రాన్ కరీం"), relation: "son", kin: "mother", phone: "+91 90000 00703", city: t("Hyderabad", "हैदराबाद", "హైదరాబాద్"), timeZone: "Asia/Kolkata", reportLanguage: "hi", primary: true },
  { id: "f_sana", patientId: "p_abdul", name: t("Sana Kareem", "सना करीम", "సనా కరీం"), relation: "daughter", kin: "father", phone: "+91 90000 00704", city: t("Lucknow", "लखनऊ", "లక్నో"), timeZone: "Asia/Kolkata", reportLanguage: "hi", primary: true },
  { id: "f_anna", patientId: "p_thomas", name: t("Anna Thomas", "एना थॉमस", "అన్నా థామస్"), relation: "daughter", kin: "father", phone: "+971 50 000 0123", city: t("Dubai", "दुबई", "దుబాయ్"), timeZone: "Asia/Dubai", reportLanguage: "en", primary: true },
  { id: "f_arjun", patientId: "p_sarala", name: t("Arjun Reddy", "अर्जुन रेड्डी", "అర్జున్ రెడ్డి"), relation: "son", kin: "mother", phone: "+91 90000 00706", city: t("Hyderabad", "हैदराबाद", "హైదరాబాద్"), timeZone: "Asia/Kolkata", reportLanguage: "te", primary: true },
  { id: "f_kiran", patientId: "p_sarala", name: t("Kiran Reddy", "किरण रेड्डी", "కిరణ్ రెడ్డి"), relation: "grandson", kin: "grandmother", phone: "+44 7700 900123", city: t("London, United Kingdom", "लंदन, ब्रिटेन", "లండన్, బ్రిటన్"), timeZone: "Europe/London", reportLanguage: "en", primary: false },
];

function buildPatient(s: PatientSeed, startOverride?: LocalDate): Patient {
  const start = startOverride ?? s.start;
  const lengthDays = s.lengthDays;
  // A monthly-plan patient joined two months before the current period.
  const firstDay = s.kind === "monthly" ? addDays(start, -60) : start;
  const enrolledAt = atLocal(firstDay, "10:15");
  const enteredAt = atLocal(firstDay, "10:40");
  const verifiedAt = atLocal(firstDay, "10:55");
  const meds: Medicine[] = s.meds.map((m, i) => ({
    id: `${s.id}_m${i + 1}`,
    name: m.name,
    dose: m.dose,
    perDose: m.perDose,
    slots: m.slots,
    food: m.food,
    dispensed: m.dispensed,
    startDate: start,
    endDate: addDays(start, (m.days ?? (s.kind === "monthly" ? 120 : lengthDays)) - 1),
  }));
  return {
    id: s.id,
    name: s.name,
    honorific: s.honorific,
    gender: s.gender,
    age: s.age,
    phone: s.phone,
    sharesPhoneWith: s.sharesPhoneWith,
    language: s.language,
    phoneType: s.phoneType,
    condition: s.condition,
    hospitalId: HOSPITAL.id,
    doctorId: s.doctorId,
    nurseId: s.nurseId,
    address: s.address,
    distanceKm: s.distanceKm,
    mealTimes: { ...DEFAULT_MEAL_TIMES, ...s.meals },
    callTimes: {},
    enrolledAt,
    enrolledBy: s.enrolledBy,
    consent: { calls: true, shareFamily: true, shareDoctor: true, recordedAt: enrolledAt, recordedBy: s.enrolledBy },
    dischargeSummary: { fileName: `discharge-summary-${s.id.slice(2)}.pdf`, uploadedAt: enrolledAt + 4 * MIN },
    prescriptions: [{ id: `${s.id}_rx1`, medicines: meds, status: "verified", enteredBy: s.nurseId, enteredAt, verifiedBy: s.nurseId === "n_mary" ? "n_kavitha" : "n_mary", verifiedAt }],
    callsFrom: verifiedAt,
    pkg: {
      kind: s.kind,
      lengthDays,
      startDate: start,
      endDate: endDateFor(start, lengthDays),
      status: "active",
      paid: true,
      monthNo: s.monthNo,
    },
    carePlan: {
      pattern: defaultPattern(s.kind),
      tasks: s.tasks ?? ["vitals", "pillCount"],
      visitStart: s.visitStart ?? "11:00",
      caregiverId: s.caregiverId,
    },
    nextReviewDate: s.review ? addDays(start, s.review) : undefined,
    hue: s.hue,
    baseline: s.baseline,
  };
}

/** Scripted moments in the sample history (patient|date|slot|n-th call that day). */
function forcedHistory(): Record<string, CallInput[]> {
  return {
    // Mrs Lakshmi Devi asked to be called later once.
    "p_lakshmi|2026-10-04|breakfast|1": SCRIPTS.later(30),
    // Mr Ramesh Gupta felt unwell one morning; the nurse called him.
    "p_ramesh|2026-09-30|breakfast|1": SCRIPTS.unwell(),
    // ...and kept postponing dinner one evening.
    "p_ramesh|2026-10-04|dinner|1": SCRIPTS.later(30),
    "p_ramesh|2026-10-04|dinner|2": SCRIPTS.later(30),
    "p_ramesh|2026-10-04|dinner|3": SCRIPTS.later(30),
    // Mrs Fatima Begum: her husband answered, twice; unclear speech this morning.
    "p_fatima|2026-10-02|dinner|1": SCRIPTS.someoneElse(30),
    "p_fatima|2026-10-04|breakfast|1": SCRIPTS.unclearThenKeypad(),
    "p_fatima|2026-10-05|breakfast|1": SCRIPTS.unclearAll(),
    // Mr Abdul Kareem: Fatima answered his lunch call twice in one day.
    "p_abdul|2026-10-03|lunch|1": SCRIPTS.someoneElse(30),
    "p_abdul|2026-10-03|lunch|2": SCRIPTS.someoneElseAgain(),
    // Mr Thomas Mathew did not pick up three times.
    "p_thomas|2026-10-01|lunch|1": SCRIPTS.noAnswer(),
    "p_thomas|2026-10-01|lunch|2": SCRIPTS.noAnswer(),
    "p_thomas|2026-10-01|lunch|3": SCRIPTS.noAnswer(),
    // Mrs Sarala Reddy said no to one dose.
    "p_sarala|2026-10-03|dinner|1": SCRIPTS.refuse(),
    // Mr Ramesh Gupta asked for a person this morning (still open).
    "p_ramesh|2026-10-05|breakfast|1": SCRIPTS.wantPerson(),
  };
}

export function emptyData(): DemoData {
  return {
    seq: 0,
    hospitals: [HOSPITAL],
    staff: STAFF.map((s) => structuredClone(s)),
    patients: [],
    family: [],
    packages: structuredClone(DEFAULT_PACKAGES),
    calls: [],
    queue: [],
    log: [],
    flags: [],
    visits: [],
    reports: [],
    messages: [],
    payments: [],
    audit: [],
    events: [],
    callbacks: [],
    phone: {},
    done: {},
    settings: { skippedFocusCalls: "taken", autoVisits: true, breakNextReport: false, paymentOutcome: "success", uploadFails: false },
  };
}

function enrolSeedPatient(data: DemoData, s: PatientSeed) {
  const p = buildPatient(s);
  data.patients.push(p);
  for (const f of FAMILY.filter((f) => f.patientId === p.id)) data.family.push(structuredClone(f));
  const who = { $person: p.id };
  audit(data, p.enrolledAt, s.enrolledBy, "desk", "created", p.id, "audit.enrolled", { patient: who }, p.id);
  audit(data, p.enrolledAt + MIN, s.enrolledBy, "desk", "created", p.id, "audit.consentRecorded", { patient: who }, p.id);
  audit(data, p.prescriptions[0].enteredAt!, p.nurseId, "nurse", "created", p.prescriptions[0].id, "audit.rxEntered", { patient: who }, p.id);
  audit(data, p.prescriptions[0].verifiedAt!, p.prescriptions[0].verifiedBy!, "nurse", "verified", p.prescriptions[0].id, "audit.rxVerified", { patient: who }, p.id);
  emit(data, p.enrolledAt, "event.enrolled", { patient: who }, ["desk", "nurse", "admin"], "info", p.id);
  const fam = data.family.find((f) => f.patientId === p.id && f.primary);
  const amount = data.packages.find((x) => x.id === p.pkg.kind)!;
  const price = p.pkg.kind === "monthly" ? amount.prices.month ?? 0 : amount.prices[p.pkg.lengthDays as 7 | 14 | 30] ?? 0;
  if (p.id === "p_ramesh") {
    data.payments.push({ id: `pay_${p.id}_f`, patientId: p.id, familyId: fam?.id, kind: p.pkg.kind, lengthDays: p.pkg.lengthDays, amount: price, at: p.enrolledAt + 20 * MIN, status: "failed", method: "card", purpose: "new" });
  }
  data.payments.push({ id: `pay_${p.id}`, patientId: p.id, familyId: fam?.id, kind: p.pkg.kind, lengthDays: p.pkg.lengthDays, amount: price, at: p.enrolledAt + 30 * MIN, status: "success", method: p.id === "p_sarala" ? "desk" : "upi", purpose: p.pkg.kind === "monthly" ? "monthly" : "new" });
  if (p.id === "p_sarala") {
    data.payments.push({ id: `pay_${p.id}_dup`, patientId: p.id, familyId: fam?.id, kind: p.pkg.kind, lengthDays: p.pkg.lengthDays, amount: price, at: p.enrolledAt + 34 * MIN, status: "refunded", method: "upi", purpose: "new" });
  }
  if (p.pkg.kind === "monthly") {
    for (const m of [1, 2]) {
      data.payments.push({ id: `pay_${p.id}_m${m}`, patientId: p.id, familyId: fam?.id, kind: "monthly", lengthDays: 30, amount: price, at: p.enrolledAt - (3 - m) * 30 * 86_400_000, status: "success", method: "upi", purpose: "monthly" });
    }
  }
  if (p.carePlan.pattern !== "none") planVisits(data, p);
  ensureDayCalls(data, p, s.start, Math.max(p.callsFrom!, atLocal(s.start, "10:15")));
}

export interface SeedOptions {
  /** Leave Mrs Lakshmi Devi out (story mode enrols her live). */
  withoutLakshmi?: boolean;
  until?: number;
}

export function buildSeed(opts: SeedOptions = {}): { data: DemoData; now: number } {
  const data = emptyData();
  const until = opts.until ?? EXPLORE_START;
  const seeds = PATIENTS.filter((s) => !(opts.withoutLakshmi && s.id === LAKSHMI_ID)).sort((a, b) => a.start.localeCompare(b.start));
  let now = atLocal(seeds[0].start, "00:00");
  const forced = forcedHistory();
  const forcedMismatch = new Set(["p_ramesh|2026-10-05", "p_fatima|2026-10-02"]);

  for (const s of seeds) {
    const enrolAt = atLocal(s.start, "10:15");
    advanceClock(data, now, enrolAt, { ringAtTarget: false, quietBackground: true, forced, forcedMismatch, autoNurseBefore: atLocal(DEMO_TODAY, "00:00") });
    now = enrolAt;
    enrolSeedPatient(data, s);
  }

  // A caregiver missed one visit in the history.
  const fatimaVisit = data.visits.find((v) => v.patientId === "p_fatima" && v.date === "2026-10-03");
  if (fatimaVisit) fatimaVisit.noShow = true;

  // One report in the history failed its check and was not sent.
  advanceClock(data, now, atLocal("2026-10-02", "19:00"), { ringAtTarget: false, quietBackground: true, forced, forcedMismatch, autoNurseBefore: atLocal(DEMO_TODAY, "00:00") });
  now = atLocal("2026-10-02", "19:00");
  data.settings.breakNextReport = true;
  advanceClock(data, now, until, { focusPatientId: "p_ramesh", ringAtTarget: false, quietBackground: true, forced, forcedMismatch, autoNurseBefore: atLocal(DEMO_TODAY, "00:00") });
  data.settings.breakNextReport = false;
  if (fatimaVisit) fatimaVisit.noShow = false;
  now = until;

  // Sample views by staff, so the audit trail shows reads as well as changes.
  const views: Array<[string, "doctor" | "nurse", string, string]> = [
    ["d_anjali", "doctor", LAKSHMI_ID, "09:10"],
    ["d_vikram", "doctor", "p_ramesh", "09:20"],
    ["n_mary", "nurse", "p_fatima", "09:05"],
    ["n_kavitha", "nurse", "p_ramesh", "09:40"],
  ];
  for (const [actor, role, pid, time] of views) {
    if (!data.patients.some((p) => p.id === pid)) continue;
    const at = atLocal(DEMO_TODAY, time);
    if (at < until) audit(data, at, actor, role, "viewed", pid, "audit.viewedPatient", { patient: { $person: pid } }, pid);
  }
  data.audit.sort((a, b) => a.at - b.at);
  data.events = data.events.filter((e) => e.at >= until - 6 * 3_600_000);
  return { data, now };
}

/** Medicines as written on a patient's discharge summary (the nurse types these in). */
export function sampleMedicinesFor(patientId: string, start: LocalDate): Medicine[] {
  const s = PATIENTS.find((x) => x.id === patientId);
  const meds = s?.meds ?? [
    { name: "Paracetamol", dose: "500 mg", perDose: 1, slots: ["breakfast", "dinner"] as Slot[], food: "after" as const, dispensed: 20, days: 10 },
    { name: "Pantoprazole", dose: "40 mg", perDose: 1, slots: ["breakfast"] as Slot[], food: "before" as const, dispensed: 14 },
  ];
  return meds.map((m, i) => ({
    id: `${patientId}_m${i + 1}`,
    name: m.name,
    dose: m.dose,
    perDose: m.perDose,
    slots: [...m.slots],
    food: m.food,
    dispensed: m.dispensed,
    startDate: start,
    endDate: addDays(start, (m.days ?? 14) - 1),
  }));
}

/** A sample patient as the desk would enrol them today: no prescription yet, no calls yet. */
export function patientFromSample(id: string, start: LocalDate): { patient: Patient; family: FamilyMember[] } | undefined {
  const s = PATIENTS.find((x) => x.id === id);
  if (!s) return undefined;
  const p = buildPatient(s, start);
  return {
    patient: { ...p, prescriptions: [], callsFrom: undefined, nextReviewDate: undefined, dischargeSummary: undefined, pkg: { ...p.pkg, paid: false } },
    family: FAMILY.filter((f) => f.patientId === id).map((f) => structuredClone(f)),
  };
}
