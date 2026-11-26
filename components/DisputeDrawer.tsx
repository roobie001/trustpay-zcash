"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Send,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import type { EscrowOrder } from "@/lib/supabase";
import {
  parseOrderMetadata,
  type DisputeMessage,
} from "@/lib/storage";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

interface DisputeDrawerProps {
  open: boolean;
  order: EscrowOrder;
  isSeller: boolean;
  onClose: () => void;
  onStatusUpdated: (newStatus: "DISPUTED") => void;
}

const DISPUTE_REASONS = [
  "Item not delivered",
  "Wrong or damaged item",
  "Seller delayed dispatch past SLA",
  "Buyer unresponsive at handover",
] as const;

export function DisputeDrawer({
  open,
  order,
  isSeller,
  onClose,
  onStatusUpdated,
}: DisputeDrawerProps) {
  const [selectedReason, setSelectedReason] = useState<string>(DISPUTE_REASONS[0]);
  const [initialStatement, setInitialStatement] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evidence thread state
  const [newMessage, setNewMessage] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { metadata } = parseOrderMetadata(order.delivery_notes);
  const isAlreadyDisputed = order.status === "DISPUTED";
  const disputeCategory = metadata.dispute_category || "Item not delivered";
  const messages = Array.isArray(metadata.dispute_thread) ? metadata.dispute_thread : [];

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages.length]);

  if (!open) return null;

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be smaller than 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  }

  async function handleRaiseDispute(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedReason) {
      setError("Please select a dispute reason.");
      return;
    }

    setSubmittingDispute(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "DISPUTED",
          dispute_category: selectedReason,
          message: initialStatement.trim() || `Dispute raised: ${selectedReason}`,
          photoUrl: photoPreview ?? undefined,
          sender: isSeller ? "seller" : "buyer",
        }),
      });

      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Failed to register dispute.");
      }

      setInitialStatement("");
      setPhotoPreview(null);
      onStatusUpdated("DISPUTED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register dispute.");
    } finally {
      setSubmittingDispute(false);
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() && !photoPreview) return;

    setSendingMessage(true);
    setError(null);

    const disputeMsg: DisputeMessage = {
      id: `msg_${Date.now()}`,
      sender: isSeller ? "seller" : "buyer",
      text: newMessage.trim(),
      photoUrl: photoPreview ?? undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/orders/${order.id}/meta`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          disputeMessage: disputeMsg,
        }),
      });

      const resData = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !resData.success) {
        throw new Error(resData.error ?? "Failed to send evidence.");
      }

      setNewMessage("");
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post message.");
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-title"
        className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-t-2xl border border-slate-800/80 bg-[#0F172A] shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h2 id="dispute-title" className="text-base sm:text-lg font-semibold tracking-tight text-white">
                {isAlreadyDisputed ? "Structured Dispute Resolution" : "Raise an Escrow Dispute"}
              </h2>
              <p className="text-xs text-slate-400">
                {isAlreadyDisputed ? `Reason: ${disputeCategory}` : "Payouts will be frozen immediately"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Dispute Warning Banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="text-xs leading-relaxed text-amber-200">
                <span className="font-semibold text-amber-300">Escrow Vault Freeze Active:</span> All
                on-chain payouts are locked. Funds remain in the shielded vault until both parties align or
                evidence satisfies the Escrow Settlement Criteria.
              </div>
            </div>
          </div>

          {/* Settlement Criteria Checklist */}
          <div className="rounded-xl border border-slate-800/80 bg-[#030712] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <FileText className="h-4 w-4 text-amber-500" />
              Escrow Settlement Criteria Checklist
            </h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              <li className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3 text-xs">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">1. Seller Dispatch Proof</span>
                  <p className="mt-0.5 text-xs text-slate-400">Waybill slip, rider phone log, dispatch receipt.</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3 text-xs">
                <Camera className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">2. Buyer Unboxing Evidence</span>
                  <p className="mt-0.5 text-xs text-slate-400">Uncut unboxing photos showing seals and defects.</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">3. Delivery SLA &amp; Handover PIN</span>
                  <p className="mt-0.5 text-xs text-slate-400">Rider timestamp &amp; 4-digit handover verification.</p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-[#0B1120] p-3 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <span className="font-semibold text-white">4. In-App Evidence Log</span>
                  <p className="mt-0.5 text-xs text-slate-400">All messages &amp; attachments bound to the order memo.</p>
                </div>
              </li>
            </ul>
          </div>

          {!isAlreadyDisputed ? (
            /* Dispute Filing Form */
            <form onSubmit={handleRaiseDispute} className="space-y-4">
              <div>
                <label className={labelClass}>Select Dispute Category *</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DISPUTE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`flex min-h-[44px] items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition-colors ${selectedReason === reason
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
                        : "border-slate-800 bg-[#030712] text-slate-400 hover:text-white"
                        }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full border ${selectedReason === reason
                          ? "border-amber-400 bg-amber-400"
                          : "border-slate-600"
                          }`}
                      />
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="statement" className={labelClass}>
                  Initial Statement &amp; What Happened *
                </label>
                <textarea
                  id="statement"
                  rows={3}
                  value={initialStatement}
                  onChange={(e) => setInitialStatement(e.target.value)}
                  placeholder="Describe the discrepancy with dispatch, delivery, or condition..."
                  className={`${inputClass} min-h-[90px] text-sm`}
                />
              </div>

              {/* Photo Upload Attachment */}
              <div>
                <label className={labelClass}>Attach Photo Evidence (Optional)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`${secondaryButtonClass} text-xs font-semibold`}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Upload Photo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {photoPreview && (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Evidence preview"
                        className="h-12 w-12 rounded-xl border border-slate-700 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoPreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-1 text-white shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingDispute}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {submittingDispute ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                Submit Dispute &amp; Freeze Escrow
              </button>
            </form>
          ) : (
            /* Live Dispute Evidence Thread */
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live Dispute Evidence Thread ({messages.length})
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Realtime Active
                </span>
              </div>

              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No evidence messages posted yet. Use the form below to submit photos and details.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMe = (isSeller && msg.sender === "seller") || (!isSeller && msg.sender === "buyer");
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl border p-3.5 text-xs ${isMe
                            ? "border-amber-500/30 bg-amber-500/10 text-white"
                            : "border-slate-800 bg-[#030712] text-slate-200"
                            }`}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-4 text-xs text-slate-400">
                            <span className="font-semibold uppercase tracking-wider">
                              {msg.sender === "seller"
                                ? "Seller"
                                : msg.sender === "buyer"
                                  ? "Buyer"
                                  : "Mediator"}
                              {isMe ? " (You)" : ""}
                            </span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                          {msg.photoUrl && (
                            <div className="mt-2.5 overflow-hidden rounded-xl border border-slate-800">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={msg.photoUrl}
                                alt="Dispute evidence attachment"
                                className="max-h-48 w-full object-contain bg-black/60"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="space-y-3 pt-2">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Post evidence message or clarification..."
                    className={`${inputClass} min-h-[80px] pr-12 text-sm`}
                  />
                  <div className="absolute bottom-2.5 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      title="Attach photo"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {photoPreview && (
                  <div className="relative inline-flex items-center gap-2.5 rounded-xl border border-slate-800 bg-[#030712] p-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Attachment preview"
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <span className="text-slate-300">Photo attached</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="rounded-full bg-red-600/80 p-1 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {error && (
                  <p role="alert" className="text-xs text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sendingMessage || (!newMessage.trim() && !photoPreview)}
                  className={`${primaryButtonClass} w-full`}
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Evidence Message
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
