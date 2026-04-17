export function AdminLoadingScreen({ message = "Preparing admin panel..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.14),transparent_30%),linear-gradient(180deg,#0b0b12,#13131b)]">
      <div className="relative flex flex-col items-center gap-5">
        <div className="absolute -inset-8 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.14] bg-white/[0.05] backdrop-blur">
          <img src="/litysoftware.png" alt="Lity" className="h-8 w-8 object-contain" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl border border-violet-300/30 animate-pulse" />
        </div>
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/[0.12] border-t-violet-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-100">Lity Admin Panel</p>
          <p className="mt-1 text-xs text-zinc-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
