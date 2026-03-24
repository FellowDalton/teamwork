/**
 * Stream Animation Components
 *
 * Building-block animation primitives that make streamed content
 * feel like it's being assembled in real-time. No artificial delays —
 * just smooth CSS transitions triggered by mount/state changes.
 */

import React, { useRef, useEffect, useState } from 'react';

/**
 * FadeSlideIn - Elements slide up and fade in when they mount.
 * The animation is CSS-driven so it's smooth and non-blocking.
 */
export const FadeSlideIn: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number; // stagger delay in ms (keep small: 0-100ms)
}> = ({ children, className = '', delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Use requestAnimationFrame to ensure the initial state renders first
    const raf = requestAnimationFrame(() => {
      if (delay > 0) {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
      }
      setVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-300 ease-out ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * ScaleIn - Elements scale up from 95% when they appear.
 * Great for cards and panels.
 */
export const ScaleIn: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className = '', delay = 0 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (delay > 0) {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
      }
      setVisible(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        visible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-[0.97]'
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * DrawBorder - Card border that "draws" itself with a gradient reveal.
 */
export const DrawBorder: React.FC<{
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}> = ({ children, className = '', active = true }) => {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => setDrawn(true));
    }
  }, [active]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden ${className}`}
      style={{
        background: drawn
          ? 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(147,51,234,0.15))'
          : 'transparent',
        transition: 'background 0.5s ease-out',
      }}
    >
      {/* Animated border */}
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={{
          border: '1px solid',
          borderColor: drawn
            ? 'rgba(113,113,122,0.3)'
            : 'rgba(113,113,122,0)',
          transition: 'border-color 0.4s ease-out',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
};

/**
 * CountUp - Animates a number counting up from 0 to its target.
 * Uses requestAnimationFrame for smooth 60fps counting.
 */
export const CountUp: React.FC<{
  value: number;
  className?: string;
  duration?: number; // ms
  suffix?: string;
}> = ({ value, className = '', duration = 400, suffix = '' }) => {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const diff = value - start;
    if (diff === 0) return;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className={className}>{display}{suffix}</span>;
};

/**
 * TypeReveal - Text that appears character by character.
 * Not artificially slow — reveals at ~20 chars/frame for instant feel
 * with just enough motion to show it's "writing".
 */
export const TypeReveal: React.FC<{
  text: string;
  className?: string;
  charsPerFrame?: number;
}> = ({ text, className = '', charsPerFrame = 15 }) => {
  const [revealed, setRevealed] = useState(0);
  const prevLength = useRef(0);

  useEffect(() => {
    if (text.length <= prevLength.current) {
      // Text got shorter (reset) — show immediately
      setRevealed(text.length);
      prevLength.current = text.length;
      return;
    }

    // New characters added — animate reveal
    let current = prevLength.current;
    prevLength.current = text.length;

    const animate = () => {
      current = Math.min(current + charsPerFrame, text.length);
      setRevealed(current);
      if (current < text.length) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [text, charsPerFrame]);

  return (
    <span className={className}>
      {text.slice(0, revealed)}
      {revealed < text.length && (
        <span className="inline-block w-0.5 h-[1em] bg-cyan-400/60 ml-0.5 animate-pulse" />
      )}
    </span>
  );
};

/**
 * ProgressBar - Animated horizontal bar that fills.
 */
export const ProgressBar: React.FC<{
  progress: number; // 0-100
  className?: string;
  color?: string;
}> = ({ progress, className = '', color = 'from-cyan-500 to-purple-500' }) => (
  <div className={`h-1 bg-zinc-800 rounded-full overflow-hidden ${className}`}>
    <div
      className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500 ease-out`}
      style={{ width: `${Math.min(progress, 100)}%` }}
    />
  </div>
);
