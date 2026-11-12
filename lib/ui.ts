// Shared Tailwind class strings so the landing modal, buyer payment page and
// order tracker stay visually identical in light and dark mode.

export const inputClass =
  "h-11 w-full rounded-lg border border-[#262B36] bg-canvas px-3.5 text-sm text-primary-text outline-none transition placeholder:text-muted-text focus:border-brand focus:ring-1 focus:ring-brand";

export const labelClass = "mb-1.5 block text-xs font-semibold text-muted-text";

export const cardClass =
  "rounded-xl border border-border-subtle bg-surface";

export const primaryButtonClass =
  "group flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-canvas transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "flex h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-transparent px-4 text-sm font-semibold text-primary-text transition hover:bg-white/[0.04]";

export const darkButtonClass =
  "flex h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface px-4 text-sm font-semibold text-primary-text transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60";
