import type en from "./en";

type Widen<T> = T extends string ? string : T extends readonly string[] ? string[] : { [K in keyof T]: Widen<T[K]> };

/** The shape every language file must have: exactly the keys of the English file. */
export type Messages = Widen<typeof en>;

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | readonly string[] ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every translation key, e.g. "family.home.title". */
export type MessageKey = Leaves<Messages>;

export interface LanguagePack {
  code: string;
  /** Name of the language in its own script, for the language switcher. */
  nativeName: string;
  /** Two or three letters for tight spaces. */
  shortName: string;
  /** BCP 47 tag used for speech synthesis voices and the page `lang`. */
  speechLang: string;
  messages: Messages;
}
