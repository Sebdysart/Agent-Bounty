import type { ReactNode } from "react";
import { motion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextShimmerProps {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  className,
  shimmerWidth = 100,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  const transition: Transition = {
    repeat: Infinity,
    repeatType: "loop",
    duration,
    ease: "linear",
  };

  const shimmerPercent = Math.min(Math.max(shimmerWidth / 5, 5), 40);

  return (
    <motion.span
      className={cn(
        "relative inline-block bg-clip-text text-transparent",
        "bg-[length:250%_100%,auto] bg-[position:0%_0%,0_0]",
        "bg-no-repeat",
        className
      )}
      initial={{ backgroundPosition: "100% 0%, 0 0" }}
      animate={{ backgroundPosition: "-100% 0%, 0 0" }}
      transition={transition}
      style={{
        backgroundImage: `linear-gradient(
          90deg,
          transparent 0%,
          transparent ${50 - shimmerPercent - spread}%,
          currentColor ${50 - shimmerPercent / 2}%,
          currentColor ${50 + shimmerPercent / 2}%,
          transparent ${50 + shimmerPercent + spread}%,
          transparent 100%
        ), linear-gradient(currentColor, currentColor)`,
        WebkitBackgroundClip: "text",
      }}
    >
      {children}
    </motion.span>
  );
}

export default TextShimmer;
