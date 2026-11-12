export function SocialPatternBg() {
  const pattern = `<svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><g fill="%23FFFFFF"><path d="M20 20c-5.5 0-10 4.5-10 10 0 2 .6 3.8 1.6 5.3L10 42l6.9-1.8c1.4.9 3.2 1.4 5.1 1.4 5.5 0 10-4.5 10-10s-4.5-10-10-10zm0 16c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/><path d="M95 20l-15 6 5 4 4-2-2 3 5 4 3-15z"/><path d="M30 80l6 8-6 8h3l4-5.5 4 5.5h3l-6-8 6-8h-3l-4 5.5-4-5.5h-3z"/><path d="M80 80h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H80c-1.1 0-2-.9-2-2V82c0-1.1.9-2 2-2zm7 14c2.8 0 5-2.2 5-5s-2.2-5-5-5-5 2.2-5 5 2.2 5 5 5z"/><path d="M60 45l8-4v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11v-6l8 4z"/></g></svg>`;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -top-32 left-1/2 h-[350px] w-[700px] -translate-x-1/2 rounded-full opacity-25 blur-[140px]" style={{ background: "radial-gradient(circle, #00F59B 0%, #2775CA 50%, transparent 80%)" }} />
      <div className="absolute inset-0 opacity-[0.035] [mask-image:radial-gradient(ellipse_at_center,white,transparent_85%)]" style={{ backgroundImage: `url("data:image/svg+xml,${pattern}")`, backgroundRepeat: "repeat", backgroundSize: "120px 120px" }} />
    </div>
  );
}
