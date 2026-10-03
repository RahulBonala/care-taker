import { DEFAULT_MEAL_TIMES } from "@/domain/schedule";
import type { EnrolForm } from "./roleActions";

export const EMPTY_ENROL: EnrolForm = {
  name: "",
  honorific: "mrs",
  gender: "f",
  age: 65,
  phone: "",
  language: "te",
  phoneType: "keypad",
  meals: { ...DEFAULT_MEAL_TIMES },
  address: "",
  condition: "",
  doctorId: "d_anjali",
  familyName: "",
  familyPhone: "",
  relation: "son",
  kind: "callVisit",
  lengthDays: 14,
  payAtDesk: false,
  consent: { calls: false, shareFamily: false, shareDoctor: false },
};

/** The story's discharge: Mrs Lakshmi Devi (Telugu, keypad phone, son in the United States). */
export const LAKSHMI_ENROL: EnrolForm = {
  ...EMPTY_ENROL,
  sample: "p_lakshmi",
  name: "Lakshmi Devi",
  honorific: "mrs",
  gender: "f",
  age: 67,
  phone: "+91 90000 00101",
  language: "te",
  phoneType: "keypad",
  meals: { ...DEFAULT_MEAL_TIMES, breakfast: "08:00", lunch: "13:00", dinner: "19:00" },
  address: "12-3-45, Street 4, Malkajgiri, Hyderabad",
  condition: "After knee replacement",
  doctorId: "d_anjali",
  familyName: "Ravi Kumar",
  familyPhone: "+1 201 555 0142",
  relation: "son",
  kind: "callVisit",
  lengthDays: 14,
  payAtDesk: true,
};
