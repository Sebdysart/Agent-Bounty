import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2, Wand2 } from "lucide-react";
import "./animated-generate-button.css";

interface AnimatedGenerateButtonProps {
  generating?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  highlightHueDeg?: number;
}

export function AnimatedGenerateButton({
  generating = false,
  onClick,
  children,
  className,
  disabled = false,
  highlightHueDeg = 280,
}: AnimatedGenerateButtonProps) {
  const safeHue = ((highlightHueDeg % 360) + 360) % 360;

  return (
    <motion.button
      className={cn(
        "animated-generate-button",
        "relative inline-flex items-center justify-center gap-2",
        "px-6 py-3 rounded-lg font-medium",
        "bg-primary text-primary-foreground",
        "transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        generating && "generating",
        className
      )}
      onClick={onClick}
      disabled={disabled || generating}
      whileHover={{ scale: generating ? 1 : 1.02 }}
      whileTap={{ scale: generating ? 1 : 0.98 }}
      style={{
        "--highlight-hue": `${safeHue}deg`,
      } as React.CSSProperties}
      data-testid="button-animated-generate"
    >
      <div
        className="glow-effect"
        style={{
          background: `radial-gradient(circle at center, hsl(${safeHue} 80% 60% / 0.4), transparent 70%)`,
          filter: "blur(8px)",
        }}
      />
      
      <span className="sparkle" />
      <span className="sparkle" />
      <span className="sparkle" />
      <span className="sparkle" />
      
      <div className="pulse-ring" style={{ borderColor: `hsl(${safeHue} 80% 70% / 0.5)` }} />

      <motion.span
        className="relative z-10 flex items-center gap-2"
        animate={generating ? { opacity: [1, 0.7, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            {children ? (
              children
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generate</span>
              </>
            )}
          </>
        )}
      </motion.span>
    </motion.button>
  );
}

export default AnimatedGenerateButton;
