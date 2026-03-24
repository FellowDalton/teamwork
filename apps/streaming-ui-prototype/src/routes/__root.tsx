import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { StreamProvider } from '../streaming/hooks/StreamContext';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <StreamProvider>
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        {/* Minimal Nav */}
        <nav className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                S
              </div>
              <span className="text-sm font-semibold text-zinc-300">Streaming UI</span>
            </Link>
            <div className="flex items-center gap-1">
              <NavLink to="/" label="Home" />
              <NavLink to="/demo" label="Demo" />
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
        <footer className="border-t border-zinc-800/50 py-3 text-center">
          <span className="text-[10px] text-zinc-600 font-mono">
            VITE + TANSTACK ROUTER + CLAUDE AGENT SDK + NDJSON STREAMING
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
      className="text-xs px-2.5 py-1.5 rounded-md transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
      activeProps={{ className: 'text-xs px-2.5 py-1.5 rounded-md bg-zinc-800/80 text-zinc-200' }}
    >
      {label}
    </Link>
  );
}
