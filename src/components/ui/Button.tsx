"use client";

import type { LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "ok";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:brightness-110 active:brightness-95 border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface-2",
  danger: "bg-danger text-white dark:text-[#2a0705] border border-transparent hover:brightness-110",
  soft: "bg-brand-soft text-brand border border-transparent hover:brightness-95",
  ok: "bg-ok text-white dark:text-[#06200f] border border-transparent hover:brightness-110",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3 text-sm gap-1.5 rounded-lg",
  md: "min-h-12 px-4 text-base gap-2 rounded-xl",
  lg: "min-h-14 px-5 text-lg gap-2.5 rounded-2xl",
  xl: "min-h-16 px-6 text-xl gap-3 rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  full?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, iconRight: IconRight, full, className, children, type = "button", ...rest },
  ref,
) {
  const iconSize = size === "sm" ? 16 : size === "xl" ? 24 : 20;
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center text-center font-semibold leading-tight transition select-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden size={iconSize} className="shrink-0" />}
      {children != null && <span className="min-w-0">{children}</span>}
      {IconRight && <IconRight aria-hidden size={iconSize} className="shrink-0" />}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = "ghost", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-10 w-10" : "h-12 w-12",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden size={size === "sm" ? 18 : 22} />
    </button>
  );
});
