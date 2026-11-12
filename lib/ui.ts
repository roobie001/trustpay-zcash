// Shared Tailwind class strings so the landing modal, buyer payment page and
// order tracker stay visually identical in light and dark mode.

export const inputClass =
  "w-full rounded-xl border border-white/[0.10] bg-[#07080B]/80 px-3.5 py-2.5 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-[#00F59B]/60 focus:ring-4 focus:ring-[#00F59B]/10 sm:text-sm";

export const labelClass = "mb-1.5 block text-sm font-medium text-slate-300";

export const cardClass =
  "rounded-2xl border border-white/[0.08] bg-[#0E121A]/85 shadow-2xl shadow-black/20 backdrop-blur-xl";

export const primaryButtonClass =
  "group flex items-center justify-center gap-2 rounded-xl bg-[#00F59B] px-4 py-3 text-sm font-bold text-[#06110c] shadow-lg shadow-[#00F59B]/20 transition hover:-translate-y-px hover:bg-[#00DC8B] hover:shadow-[#00F59B]/30 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";

export const secondaryButtonClass =
  "flex items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]";

export const darkButtonClass =
  "flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200";
