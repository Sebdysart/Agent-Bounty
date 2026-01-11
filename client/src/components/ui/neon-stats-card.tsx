import * as React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";

export type NeonStatCardProps = {
  icon: LucideIcon;
  value: number;
  label: string;
  format: "number" | "currency" | "percentage";
  index: number;
  reanimateOnHover?: boolean;
  updatedAt?: string;
};

export const NeonStatCard: React.FC<NeonStatCardProps> = ({
  icon: Icon,
  value,
  label,
  format,
  index,
  reanimateOnHover = false,
  updatedAt,
}) => {
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const getFormatConfig = () => {
    switch (format) {
      case "currency":
        return {
          prefix: "$",
          suffix: "",
          decimals: 0,
          separator: ",",
        };
      case "percentage":
        return {
          prefix: "",
          suffix: "%",
          decimals: 1,
          separator: "",
        };
      default:
        return {
          prefix: "",
          suffix: "",
          decimals: 0,
          separator: ",",
        };
    }
  };

  const config = getFormatConfig();

  const { formattedValue, start, reset } = useCountUp({
    end: value,
    duration: 1800,
    ...config,
  });

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsInView(true);
          setHasAnimated(true);
          setTimeout(() => {
            start();
          }, index * 120);
        }
      },
      { threshold: 0.3 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [hasAnimated, start, index]);

  const handleHoverStart = () => {
    if (reanimateOnHover && hasAnimated) {
      reset();
      setTimeout(() => start(), 50);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{
        duration: 0.4,
        delay: index * 0.12,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      onHoverStart={handleHoverStart}
      className="relative rounded-xl p-[1px] bg-gradient-to-br from-violet-500/40 via-fuchsia-500/40 to-cyan-500/40 group"
      tabIndex={reanimateOnHover ? 0 : undefined}
      role={reanimateOnHover ? "button" : undefined}
      aria-label={`${label}: ${formattedValue}`}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="relative h-full w-full rounded-xl bg-background/60 backdrop-blur-xl border border-border/40 p-6 shadow-lg transition-shadow duration-300 group-hover:shadow-[0_0_24px_rgba(168,85,247,0.15)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
              <Icon
                className="w-5 h-5 text-violet-400"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))",
                }}
              />
            </div>
          </div>

          <div
            className="text-4xl font-bold text-foreground tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {formattedValue}
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-sm text-muted-foreground">{label}</div>
            {updatedAt && (
              <div className="text-xs text-muted-foreground/60">
                Updated just now
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
