
import React, { useState } from 'react';

interface AnalogButtonProps {
  label?: string;
  isActive?: boolean;
  onClick: () => void;
  ledColor?: 'green' | 'red' | 'blue' | 'yellow' | 'orange' | 'purple' | 'cyan';
  icon?: React.ReactNode;
  className?: string;
  subLabel?: string;
  variant?: 'dark' | 'light' | 'accent';
  theme?: 'light' | 'dark';
  minimal?: boolean;
  flush?: boolean;
  noTexture?: boolean;
}

export const AnalogButton: React.FC<AnalogButtonProps> = ({ 
  label, 
  isActive = false, 
  onClick, 
  ledColor = 'green', 
  icon,
  className = '',
  subLabel,
  variant = 'dark',
  theme = 'dark',
  minimal = false,
  flush = false,
  noTexture = false
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // Determine if the button should visually appear "down"
  const isDown = isActive || isPressed;

  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);
  const handleMouseLeave = () => setIsPressed(false);

  // --- Styles Generators ---

  // 1. Background & Text Colors
  const getColors = () => {
    const baseTransition = "transition-colors duration-200";
    
    // --- ACCENT BUTTONS (Orange) ---
    if (variant === 'accent') {
        if (theme === 'light') {
             return isDown
              ? `bg-orange-600 text-white ${baseTransition}`
              : `bg-orange-500 text-white hover:bg-orange-400 ${baseTransition}`;
        }
        // Dark Theme Accent
        return isDown
          ? `bg-orange-600 text-white ${baseTransition}`
          : `bg-orange-500 text-white hover:bg-orange-400 ${baseTransition}`;
    }

    // --- LIGHT VARIANT BUTTONS (Function Keys) ---
    if (variant === 'light') {
        if (theme === 'light') {
            return isDown
               ? `bg-zinc-300 text-zinc-900 ${baseTransition}`
               : `bg-zinc-200 text-zinc-700 hover:bg-zinc-100 ${baseTransition}`;
        }
        // Dark Theme Light Variant
        return isDown
           ? `bg-zinc-300 text-zinc-900 ${baseTransition}`
           : `bg-zinc-200 text-zinc-800 hover:bg-zinc-100 ${baseTransition}`;
    }

    // --- STANDARD DARK VARIANT BUTTONS (Main Keys) ---
    // In Light Theme, these are GREY keys (was white, changed per request)
    if (theme === 'light') {
         return isDown 
            ? `bg-zinc-300 text-zinc-900 ${baseTransition}`
            : `bg-zinc-200 text-zinc-800 hover:bg-zinc-100 ${baseTransition}`;
    }
    
    // In Dark Theme, these are DARK GREY keys
    return isDown 
       ? `bg-zinc-900 text-zinc-100 ${baseTransition}`
       : `bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 ${baseTransition}`;
  };

  // 2. Shadows (The core of the 3D effect)
  const getShadowStyle = () => {
    if (flush) {
        // Flat keys flush with backboard: No 3D depth, just subtle bevel/inset
        return isDown 
            ? 'inset 0 1px 2px rgba(0,0,0,0.3)' 
            : `inset 0 0 0 1px ${theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`;
    }

    // Colors for the 3D "side" of the button
    const depthColors = {
        dark: theme === 'light' ? '#cbd5e1' : '#000000', // Light mode uses slate-300 for depth
        light: theme === 'light' ? '#94a3b8' : '#a1a1aa',
        accent: '#9a3412'
    };
    const depthColor = depthColors[variant];

    if (isDown) {
        // PRESSED STATE: No outer depth, heavy inner shadow (sunken feel) + Backlight glow if active
        let shadow = `inset 0 3px 6px rgba(0,0,0,0.5)`; // The sunken effect
        
        // Add backlight glow if active
        if (isActive && !minimal) {
            const glowMap = {
                red: '244,63,94',
                blue: '59,130,246',
                yellow: '251,191,36',
                orange: '249,115,22',
                purple: '168,85,247',
                cyan: '34,211,238',
                green: '16,185,129'
            };
            const rgb = glowMap[ledColor] || glowMap.green;
            // Add a soft colored drop shadow to simulate light leaking
            shadow += `, 0 0 12px rgba(${rgb}, 0.4)`;
        }
        return shadow;
    }

    // NORMAL STATE: 3D Depth side + Drop Shadow
    // Lighter shadow for light mode
    const dropShadow = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)';
    return `0 4px 0 ${depthColor}, 0 6px 6px -1px ${dropShadow}`;
  };

  // 3. Transform (Movement)
  const transformStyle = () => {
    if (flush) return 'none'; // Flat keys don't move physically
    return isDown ? 'translateY(2px)' : 'translateY(0)';
  };

  // 4. LED Dot Style
  const getLedStyle = () => {
    const base = "w-1.5 h-1.5 rounded-full transition-all duration-300";
    // Off state
    if (!isActive) return `${base} ${theme === 'light' ? 'bg-zinc-300 shadow-inner' : 'bg-zinc-950 shadow-inner opacity-20'}`; 

    const colors = {
        red: 'bg-rose-500 shadow-[0_0_8px_1px_rgba(244,63,94,0.8)]',
        blue: 'bg-blue-500 shadow-[0_0_8px_1px_rgba(59,130,246,0.8)]',
        yellow: 'bg-amber-400 shadow-[0_0_8px_1px_rgba(251,191,36,0.8)]',
        orange: 'bg-orange-500 shadow-[0_0_8px_1px_rgba(249,115,22,0.8)]',
        purple: 'bg-purple-500 shadow-[0_0_8px_1px_rgba(168,85,247,0.8)]',
        cyan: 'bg-cyan-400 shadow-[0_0_8px_1px_rgba(34,211,238,0.8)]',
        green: 'bg-emerald-500 shadow-[0_0_8px_1px_rgba(16,185,129,0.8)]'
    };
    return `${base} ${colors[ledColor] || colors.green}`;
  };

  // 5. Sublabel Text Color
  const getSubLabelColor = () => {
      if (variant === 'accent') return 'text-orange-100 opacity-90';
      if (theme === 'light') return isDown ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-zinc-600';
      return isDown ? 'text-zinc-500' : 'text-zinc-500 group-hover:text-zinc-400';
  };

  // Use the larger, raised texture for buttons
  const textureClass = theme === 'light' ? 'bg-texture-btn-light' : 'bg-texture-btn-dark';

  // Layout logic
  const spacingClass = flush ? 'w-full m-0' : 'w-[calc(100%-4px)] m-[2px]';
  const radiusClass = flush ? 'rounded-[2px]' : (minimal ? 'rounded-md' : 'rounded-lg');
  const layoutClass = minimal ? 'justify-center items-center' : 'justify-between items-start';

  return (
    <button
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`
        relative flex flex-col 
        ${layoutClass} ${radiusClass} ${spacingClass}
        outline-none overflow-hidden z-10 p-3 group
        ${getColors()}
        ${className}
      `}
      style={{
          boxShadow: getShadowStyle(),
          transform: transformStyle(),
          transition: flush ? 'background-color 0.1s' : 'transform 0.08s ease-out, box-shadow 0.08s ease-out, background-color 0.2s'
      }}
    >
      {/* Texture Overlay - Blended opacity with boost for active state */}
      {!noTexture && (
        <div className={`absolute inset-0 ${textureClass} ${isActive ? 'opacity-[0.05] brightness-200' : 'opacity-[0.15]'} pointer-events-none`} />
      )}

      {/* Icon & Label */}
      <div className={`flex items-center gap-3 relative z-20 ${minimal ? 'justify-center w-full' : 'w-full'}`}>
        {icon && (
            <span className={`transition-opacity duration-200 ${variant === 'accent' ? 'text-white opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                {icon}
            </span>
        )}
        {!minimal && (
            <span className={`font-semibold text-sm tracking-tight truncate select-none ${variant === 'accent' ? 'text-white' : ''}`}>
                {label}
            </span>
        )}
      </div>

      {/* Footer: Sublabel & LED */}
      {!minimal && (
          <div className="flex items-end justify-between w-full mt-2 relative z-20">
             <span className={`text-[10px] uppercase font-bold tracking-wider select-none transition-colors duration-200 ${getSubLabelColor()}`}>
                {subLabel}
             </span>
             
             {/* LED Housing */}
             <div className={`${theme === 'light' ? 'bg-zinc-200' : 'bg-black/40'} p-1 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]`}>
                <div className={getLedStyle()} />
             </div>
          </div>
      )}
      
      {/* Top Edge Highlight (simulates plastic bevel reflection) - hidden for flush keys */}
      {!flush && (
        <div className={`absolute top-0 left-0 right-0 h-[1px] ${isDown ? 'opacity-0' : 'bg-white/30'} pointer-events-none transition-opacity duration-100`} />
      )}
      
    </button>
  );
};
