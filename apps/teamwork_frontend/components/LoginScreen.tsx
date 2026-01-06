import React, { useState } from "react";
import { Layout, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function LoginScreen() {
  const { signIn, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] bg-noise flex flex-col items-center justify-center p-6">
      {/* Ambient glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Top hardware panel */}
        <div className="bg-[#18181b] border border-black rounded-t-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="w-14 h-14 rounded-xl bg-[#27272a] border-b-4 border-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] flex items-center justify-center">
              <Layout className="text-zinc-400 w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-2xl tracking-tighter text-zinc-200">
                TEAMWORK ASSISTANT
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                by Fellow
              </p>
            </div>
          </div>

          {/* Status LEDs */}
          <div className="flex gap-2 mt-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0c0c0e] rounded border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
              <span className="text-[10px] font-mono text-cyan-600 uppercase tracking-wider">
                System Ready
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0c0c0e] rounded border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-mono text-amber-600 uppercase tracking-wider">
                Auth Required
              </span>
            </div>
          </div>
        </div>

        {/* Main content panel */}
        <div className="bg-[#0c0c0e] border-x border-black p-8">
          {/* LCD-style display */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-lg p-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Scanlines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30" />

            <div className="relative z-10">
              <p className="text-cyan-500 font-mono text-sm mb-2">
                &gt; AUTHENTICATION_REQUIRED
              </p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Sign in with your Microsoft account to access the Teamwork AI
                assistant. Your conversations will be securely saved.
              </p>
            </div>
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={isLoading || isSigningIn}
            className="w-full mt-6 relative group"
          >
            {/* Button base */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-700 rounded-lg transform group-hover:translate-y-0.5 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500 to-blue-600 rounded-lg border border-blue-400/20 group-active:translate-y-0.5 transition-transform" />

            {/* Button content */}
            <div className="relative flex items-center justify-center gap-3 px-6 py-4 font-medium text-white">
              {/* Microsoft logo */}
              <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span className="text-base">
                {isSigningIn ? "Connecting..." : "Sign in with Microsoft"}
              </span>
            </div>
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Bottom hardware panel */}
        <div className="bg-[#18181b] border border-black rounded-b-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-600">
              <Zap size={14} />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Powered by Claude AI
              </span>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-4 bg-zinc-800 rounded-sm"
                  style={{
                    opacity: i < 3 ? 1 : 0.3,
                    backgroundColor: i < 3 ? "#22d3ee" : undefined,
                    boxShadow:
                      i < 3 ? "0 0 8px rgba(34, 211, 238, 0.3)" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-zinc-600 text-xs font-mono">
        v1.0.0 · Secure Authentication via Microsoft Entra ID
      </p>
    </div>
  );
}

export default LoginScreen;
