import * as React from "react";
import { cn } from "@/lib/utils";

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success";
  size?: "sm" | "default" | "lg";
  glowIntensity?: "subtle" | "medium" | "strong";
}

export function GlowButton({
  children,
  className,
  variant = "primary",
  size = "default",
  glowIntensity = "medium",
  disabled,
  ...props
}: GlowButtonProps) {
  const sizeClasses = {
    sm: "h-8 px-3 text-sm rounded-lg",
    default: "h-9 px-4 text-sm rounded-lg",
    lg: "h-10 px-6 text-base rounded-xl",
  };

  const glowOpacity = {
    subtle: "opacity-40",
    medium: "opacity-60",
    strong: "opacity-80",
  };

  const variantStyles = {
    primary: {
      gradient: "from-violet-500 via-fuchsia-500 to-violet-500",
      bg: "bg-gradient-to-r from-violet-600 to-fuchsia-600",
      hoverBg: "hover:from-violet-500 hover:to-fuchsia-500",
      shadow: "shadow-violet-500/25",
      glow: "from-violet-500 via-fuchsia-500 to-cyan-500",
    },
    secondary: {
      gradient: "from-cyan-500 via-blue-500 to-cyan-500",
      bg: "bg-gradient-to-r from-cyan-600 to-blue-600",
      hoverBg: "hover:from-cyan-500 hover:to-blue-500",
      shadow: "shadow-cyan-500/25",
      glow: "from-cyan-500 via-blue-500 to-violet-500",
    },
    success: {
      gradient: "from-emerald-500 via-green-500 to-emerald-500",
      bg: "bg-gradient-to-r from-emerald-600 to-green-600",
      hoverBg: "hover:from-emerald-500 hover:to-green-500",
      shadow: "shadow-emerald-500/25",
      glow: "from-emerald-500 via-green-500 to-cyan-500",
    },
  };

  const styles = variantStyles[variant];

  return (
    <button
      className={cn(
        "glow-btn relative inline-flex items-center justify-center gap-2",
        "font-medium text-white",
        "transition-all duration-300 ease-out",
        "transform hover:scale-[1.02] active:scale-[0.98]",
        styles.bg,
        styles.hoverBg,
        `shadow-lg ${styles.shadow}`,
        sizeClasses[size],
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span
        className={cn(
          "glow-effect absolute -inset-[2px] rounded-[inherit] -z-10",
          "bg-gradient-to-r",
          styles.glow,
          glowOpacity[glowIntensity],
          "blur-md",
          "animate-glow-pulse"
        )}
      />
      
      <span
        className={cn(
          "glow-shimmer absolute inset-0 rounded-[inherit] overflow-hidden"
        )}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer-slow" />
      </span>

      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>

      <style>{`
        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
        
        @keyframes shimmer-slow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .glow-btn:hover .glow-effect {
          opacity: 0.9;
          filter: blur(12px);
        }
        
        .animate-glow-pulse {
          animation: glow-pulse 2s ease-in-out infinite;
        }
        
        .animate-shimmer-slow {
          animation: shimmer-slow 3s ease-in-out infinite;
        }
        
        .glow-btn:hover .animate-shimmer-slow {
          animation-duration: 1.5s;
        }
      `}</style>
    </button>
  );
}
