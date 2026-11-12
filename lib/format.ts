import { ZEC_DECIMALS } from "@/lib/zcash";

export function formatZec(amount: number): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: ZEC_DECIMALS,
  })} ZEC`;
}

/** True for a positive-or-zero decimal string with at most Zcash's 8 decimals. */
export function isValidZecInput(value: string): boolean {
  return new RegExp(`^\\d+(\\.\\d{1,${ZEC_DECIMALS}})?$`).test(value.trim());
}
