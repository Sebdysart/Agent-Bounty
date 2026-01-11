import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface RainbowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  isLoading?: boolean;
}

export const RainbowButton = forwardRef<HTMLButtonElement, RainbowButtonProps>(
  ({ className, children, isActive = false, isLoading = false, disabled, ...props }, ref) => {
    return (
      <div className="relative">
        {isActive && !disabled && (
          <>
            <div 
              className="absolute -inset-[2px] rounded-xl animate-rainbow-border opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(45deg, #fb0094, #0000ff, #00ff00, #ffff00, #ff0000, #fb0094, #0000ff, #00ff00, #ffff00, #ff0000)",
                backgroundSize: "400%",
              }}
            />
            <div 
              className="absolute -inset-[2px] rounded-xl blur-xl animate-rainbow-border opacity-60"
              style={{
                background: "linear-gradient(45deg, #fb0094, #0000ff, #00ff00, #ffff00, #ff0000, #fb0094, #0000ff, #00ff00, #ffff00, #ff0000)",
                backgroundSize: "400%",
              }}
            />
          </>
        )}
        <button
          ref={ref}
          disabled={disabled || isLoading}
          className={cn(
            "relative z-10 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200",
            isActive && !disabled
              ? "bg-black text-white border-transparent"
              : "bg-muted text-muted-foreground border border-border",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          {...props}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            children
          )}
        </button>
      </div>
    );
  }
);

RainbowButton.displayName = "RainbowButton";
