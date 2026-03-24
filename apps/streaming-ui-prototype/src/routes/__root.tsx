import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { StreamProvider } from '../streaming/hooks/StreamContext';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <StreamProvider>
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        {/* Nav Bar */}
        <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                S
              </div>
              <span className="text-sm font-semibold text-zinc-200">Streaming UI</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                PROTOTYPE
              </span>
            </div>
            <div className="flex items-center gap-1">
              <NavLink to="/" label="Demo" />
              <NavLink to="/architecture" label="Architecture" />
              <NavLink to="/edge-worker" label="Edge Worker" />
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main className="flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800 py-4 text-center">
          <span className="text-xs text-zinc-600">
            Vite + TanStack Router + Streaming NDJSON
          </span>
        </footer>
      </div>
    </StreamProvider>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-sm px-3 py-1.5 rounded-md transition-colors text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      activeProps={{ className: 'text-sm px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-100' }}
    >
      {label}
    </Link>
  );
}
