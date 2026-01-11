import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";

interface AnimatedGenerateButtonProps {
  generating?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  highlightHueDeg?: number;
  type?: "button" | "submit" | "reset";
  labelIdle?: string;
  labelActive?: string;
}

export function AnimatedGenerateButton({
  generating = false,
  onClick,
  children,
  className,
  disabled = false,
  highlightHueDeg = 280,
  type = "button",
  labelIdle = "Generate Agent",
  labelActive = "Building...",
}: AnimatedGenerateButtonProps) {
  const safeHue = ((highlightHueDeg % 360) + 360) % 360;

  return (
    <div className={cn("relative inline-block", className)}>
      <motion.button
        type={type}
        aria-label={generating ? labelActive : labelIdle}
        aria-pressed={generating}
        disabled={disabled || generating}
        onClick={onClick}
        className={cn(
          "ui-anim-btn",
          "relative flex items-center justify-center cursor-pointer select-none",
          "rounded-[24px] px-8 py-4",
          "bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a]",
          "text-white font-medium text-lg",
          "border border-violet-500/30",
          "shadow-[inset_0px_1px_1px_rgba(255,255,255,0.1),inset_0px_-2px_4px_rgba(0,0,0,0.2),0_0_20px_rgba(139,92,246,0.2),0_0_40px_rgba(217,70,239,0.1)]",
          "transition-all duration-400",
          "hover:border-violet-400/50 hover:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.15),inset_0px_-2px_4px_rgba(0,0,0,0.2),0_0_30px_rgba(139,92,246,0.3),0_0_60px_rgba(217,70,239,0.2)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          generating && "generating"
        )}
        style={{
          ["--highlight-hue" as string]: `${safeHue}deg`,
        } as React.CSSProperties}
        whileHover={{ scale: generating || disabled ? 1 : 1.02 }}
        whileTap={{ scale: generating || disabled ? 1 : 0.98 }}
        data-testid="button-animated-generate"
      >
        <div className="absolute inset-0 rounded-[24px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/20 to-violet-500/0 animate-shimmer" />
        </div>
        
        <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm" />
        
        <span className="sparkle" />
        <span className="sparkle" />
        <span className="sparkle" />
        <span className="sparkle" />
        <span className="sparkle" />
        <span className="sparkle" />
        
        {generating && (
          <div className="pulse-ring absolute inset-0 rounded-[24px] border-2 border-violet-400/50" />
        )}

        <motion.span
          className="relative z-10 flex items-center gap-3"
          animate={generating ? { opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {generating ? (
            <>
              <div className="relative">
                <Loader2 className="w-5 h-5 animate-spin text-violet-300" />
                <div className="absolute inset-0 blur-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                </div>
              </div>
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent font-semibold">
                {labelActive}
              </span>
            </>
          ) : (
            <>
              {children ? (
                children
              ) : (
                <>
                  <div className="relative">
                    <Sparkles className="w-5 h-5 text-violet-300" />
                    <div className="absolute inset-0 blur-[2px]">
                      <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
                    </div>
                  </div>
                  <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent font-semibold">
                    {labelIdle}
                  </span>
                </>
              )}
            </>
          )}
        </motion.span>
      </motion.button>
      
      <style>{`
        .ui-anim-btn {
          --padding: 4px;
          --radius: 24px;
          --transition: 0.4s;
          --highlight: hsl(var(--highlight-hue), 100%, 70%);
          --highlight-50: hsla(var(--highlight-hue), 100%, 70%, 0.5);
          --highlight-30: hsla(var(--highlight-hue), 100%, 70%, 0.3);
          --highlight-20: hsla(var(--highlight-hue), 100%, 70%, 0.2);
          --highlight-80: hsla(var(--highlight-hue), 100%, 70%, 0.8);
        }

        .ui-anim-btn::before {
          content: "";
          position: absolute;
          top: calc(0px - var(--padding));
          left: calc(0px - var(--padding));
          width: calc(100% + var(--padding) * 2);
          height: calc(100% + var(--padding) * 2);
          border-radius: calc(var(--radius) + var(--padding));
          pointer-events: none;
          background-image: linear-gradient(0deg, rgba(0,0,0,0.3), rgba(0,0,0,0.6));
          z-index: -1;
          transition: box-shadow var(--transition), filter var(--transition);
          box-shadow:
            0 -8px 8px -6px transparent inset,
            0 -16px 16px -8px transparent inset,
            1px 1px 1px rgba(255,255,255,0.1),
            2px 2px 2px rgba(255,255,255,0.05);
        }

        .ui-anim-btn::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background-image: linear-gradient(0deg, #fff, var(--highlight), var(--highlight-50), 8%, transparent);
          background-position: 0 0;
          opacity: 0;
          transition: opacity var(--transition), filter var(--transition);
        }

        .ui-anim-btn .sparkle {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: white;
          opacity: 0;
          pointer-events: none;
          animation: sparkle-float 3s ease-in-out infinite;
        }

        .ui-anim-btn:hover .sparkle,
        .ui-anim-btn.generating .sparkle {
          animation: sparkle-active 1.5s ease-in-out infinite;
        }

        .ui-anim-btn .sparkle:nth-child(1) { top: 20%; left: 10%; animation-delay: 0s; }
        .ui-anim-btn .sparkle:nth-child(2) { top: 60%; left: 20%; animation-delay: 0.2s; }
        .ui-anim-btn .sparkle:nth-child(3) { top: 30%; left: 80%; animation-delay: 0.4s; }
        .ui-anim-btn .sparkle:nth-child(4) { top: 70%; left: 85%; animation-delay: 0.6s; }
        .ui-anim-btn .sparkle:nth-child(5) { top: 15%; left: 50%; animation-delay: 0.8s; }
        .ui-anim-btn .sparkle:nth-child(6) { top: 85%; left: 40%; animation-delay: 1s; }

        @keyframes sparkle-float {
          0%, 100% { opacity: 0; transform: scale(0) translateY(0); }
          50% { opacity: 0.3; transform: scale(1) translateY(-2px); }
        }

        @keyframes sparkle-active {
          0%, 100% { opacity: 0; transform: scale(0) translateY(0); }
          50% { opacity: 1; transform: scale(1.5) translateY(-4px); }
        }

        .ui-anim-btn:hover::before {
          box-shadow:
            0 -8px 8px -6px rgba(255,255,255,0.1) inset,
            0 -16px 16px -8px var(--highlight-30) inset,
            1px 1px 1px rgba(255,255,255,0.15),
            2px 2px 2px rgba(255,255,255,0.1);
        }

        .ui-anim-btn:hover::after {
          opacity: 0.5;
          -webkit-mask-image: linear-gradient(0deg, #fff, transparent);
          mask-image: linear-gradient(0deg, #fff, transparent);
        }

        .ui-anim-btn:active {
          border-color: hsla(var(--highlight-hue), 100%, 80%, 0.7);
        }

        .ui-anim-btn:active::before {
          box-shadow:
            0 -8px 12px -6px rgba(255,255,255,0.2) inset,
            0 -16px 16px -8px var(--highlight-80) inset,
            1px 1px 1px rgba(255,255,255,0.2),
            2px 2px 2px rgba(255,255,255,0.1);
        }

        .ui-anim-btn:active::after {
          opacity: 0.8;
          filter: brightness(150%);
        }

        .pulse-ring {
          animation: pulse-ring 1.5s ease-out infinite;
        }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.15); opacity: 0; }
        }

        @keyframes animate-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .animate-shimmer {
          animation: animate-shimmer 3s ease-in-out infinite;
        }

        .ui-anim-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default AnimatedGenerateButton;
