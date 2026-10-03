"use client";

import { KeyRound, MessageSquare, Smartphone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { Button, Card, Field, Input } from "@/components/ui";
import { useSpot } from "@/hooks/useSpot";
import { useT } from "@/i18n/useT";
import { familySignIn } from "@/store/roleActions";
import { useFamily } from "./useFamily";

/** Phone number and one-time password. Shown once; the family member then stays signed in. */
export function FamilySignIn() {
  const { t } = useT();
  const { f, familyId } = useFamily();
  const [phone, setPhone] = useState(f?.phone ?? "");
  const [step, setStep] = useState<"phone" | "code" | "checking">("phone");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const sendSpot = useSpot<HTMLButtonElement>("family.signin.send");
  const verifySpot = useSpot<HTMLButtonElement>("family.signin.verify");

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      setError(t("family.signIn.wrongPhone"));
      return;
    }
    setError("");
    setStep("code");
  };
  const verify = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t("family.signIn.wrongCode"));
      return;
    }
    setError("");
    setStep("checking");
    window.setTimeout(() => familySignIn(familyId), 700);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-8">
      <Card className="space-y-5 p-6">
        <BrandMark />
        <div>
          <h1 className="text-2xl font-bold">{t("family.signIn.title")}</h1>
          <p className="mt-1 text-muted">{t("family.signIn.intro")}</p>
        </div>
        {step === "phone" ? (
          <form onSubmit={send} className="space-y-4" noValidate>
            <Field label={t("family.signIn.phone")} htmlFor="fam-phone" error={error}>
              <Input id="fam-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(error)} />
            </Field>
            <Button ref={sendSpot.ref} type="submit" variant="primary" size="lg" full icon={MessageSquare} className={sendSpot.className}>
              {t("family.signIn.sendCode")}
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <p className="flex items-center gap-2 rounded-xl bg-info-soft p-3 text-info">
              <Smartphone aria-hidden size={18} />
              <span className="text-ink">{t("family.signIn.codeSent", { phone })}</span>
            </p>
            <Field label={t("family.signIn.code")} htmlFor="fam-code" hint={t("family.signIn.demoHint")} error={error}>
              <Input
                id="fam-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                aria-invalid={Boolean(error)}
                className="text-center text-2xl tracking-[0.5em]"
              />
            </Field>
            <Button ref={verifySpot.ref} type="submit" variant="primary" size="lg" full icon={KeyRound} disabled={step === "checking"} className={verifySpot.className}>
              {step === "checking" ? t("family.signIn.checking") : t("family.signIn.verify")}
            </Button>
            <Button variant="ghost" full onClick={() => setStep("phone")} disabled={step === "checking"}>
              {t("family.signIn.changeNumber")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
