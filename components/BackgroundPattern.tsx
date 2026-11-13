import { MessageCircle, Send, ShieldCheck, X } from "lucide-react";

const patternItems = [
  { icon: ShieldCheck, className: "left-[8%] top-[18%] rotate-[-12deg]" },
  { icon: X, className: "right-[12%] top-[24%] rotate-[10deg]" },
  { icon: MessageCircle, className: "left-[16%] top-[68%] rotate-[8deg]" },
  { icon: Send, className: "right-[18%] top-[76%] rotate-[-14deg]" },
];

export default function BackgroundPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-yellow-500/[0.1] blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.08] blur-3xl" />

      <div className="absolute inset-0 bg-[radial-gradient(rgba(234,179,8,0.14)_1px,transparent_1px)] [background-size:32px_32px]" />

      {patternItems.map(({ icon: Icon, className }) => (
        <Icon
          key={className}
          className={`absolute h-16 w-16 stroke-[1.25] text-yellow-500/[0.18] sm:h-20 sm:w-20 ${className}`}
        />
      ))}
    </div>
  );
}
