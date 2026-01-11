import * as React from "react";

export type CountUpConfig = {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  easingFn?: (t: number) => number;
  onComplete?: () => void;
};

const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

export const useCountUp = (config: CountUpConfig) => {
  const {
    end,
    duration = 1800,
    decimals = 0,
    prefix = "",
    suffix = "",
    separator = ",",
    easingFn = easeOutCubic,
    onComplete,
  } = config;

  const [count, setCount] = React.useState<number>(0);
  const [isAnimating, setIsAnimating] = React.useState<boolean>(false);
  const frameRef = React.useRef<number | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const formatNumber = React.useCallback(
    (value: number): string => {
      const fixed = value.toFixed(decimals);
      const [integer, decimal] = fixed.split(".");
      const formattedInteger = integer.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        separator
      );
      const result = decimal ? `${formattedInteger}.${decimal}` : formattedInteger;
      return `${prefix}${result}${suffix}`;
    },
    [decimals, prefix, suffix, separator]
  );

  const animate = React.useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      const easedProgress = easingFn(progress);
      const currentCount = easedProgress * end;

      setCount(currentCount);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
        setIsAnimating(false);
        startTimeRef.current = null;
        if (onComplete) onComplete();
      }
    },
    [end, duration, easingFn, onComplete]
  );

  const start = React.useCallback(() => {
    if (prefersReducedMotion) {
      setCount(end);
      setIsAnimating(false);
      if (onComplete) onComplete();
      return;
    }

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    setIsAnimating(true);
    startTimeRef.current = null;
    frameRef.current = requestAnimationFrame(animate);
  }, [prefersReducedMotion, end, animate, onComplete]);

  const reset = React.useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    setCount(0);
    setIsAnimating(false);
    startTimeRef.current = null;
  }, []);

  React.useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    count,
    formattedValue: formatNumber(count),
    isAnimating,
    start,
    reset,
  };
};
