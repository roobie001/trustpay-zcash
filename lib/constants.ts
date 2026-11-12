export const BRAND_NAME = "MedioPoint";
export const BRAND_TAGLINE = "The Neutral Escrow Bridge for Social Commerce";
export const VAULT_NAME = `${BRAND_NAME} Vault`;
export const DEMO_DISPUTE_REFERENCE = "MDP-902";

/** Share text for channels that take the URL separately (Telegram, X). */
export function escrowShareText(itemTitle: string): string {
  return `Pay for "${itemTitle}" privately via ${BRAND_NAME} shielded escrow — your ZEC stays locked until you confirm delivery.`;
}

export function whatsappPaymentMessage(itemTitle: string, buyerUrl: string): string {
  return `Hi! Please complete your private payment for "${itemTitle}" via ${BRAND_NAME} shielded escrow: ${buyerUrl}\n\nYour money stays protected until you confirm delivery.`;
}
