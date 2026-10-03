/**
 * The product name and tagline. Change them here and nowhere else.
 * Every screen, call line, message and handout reads them through this file.
 */
export const APP_NAME = "Care Taker";
export const APP_TAGLINE = "Someone checks on them every day";

/**
 * How the name and tagline are written for people who read Hindi or Telugu.
 * They are used only while `forName` / `forTagline` still match the constants
 * above, so renaming the app can never leave the old name in a call or a
 * report. After a rename, update these lines (or delete them to show APP_NAME
 * as it is).
 */
export const BRAND_IN_SCRIPT = {
  forName: "Care Taker",
  forTagline: "Someone checks on them every day",
  hi: { name: "केयर टेकर", tagline: "हर दिन कोई उनका हाल पूछता है" },
  te: { name: "కేర్ టేకర్", tagline: "ప్రతి రోజూ ఎవరో ఒకరు వారి క్షేమం కనుక్కుంటారు" },
} as const;

/** Sample caller number shown on the simulated phone and the patient handout. */
export const SAMPLE_CALLER_NUMBER = "+91 40 4000 0000";
