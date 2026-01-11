import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  type Placement,
  getElementRect,
  getPaddedRect,
  clampPositionToViewport,
  findBestPlacement,
  getBorderRadius,
  resolveTarget,
  isElementVisible,
  scrollIntoViewIfNeeded,
} from './spotlight-utils';

export type { Placement };

export type SpotlightStep = {
  target: string | React.RefObject<HTMLElement>;
  title: string;
  description: string;
  placement?: Placement;
};

export type SpotlightTourProps = {
  steps: SpotlightStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number) => void;
  overlayColor?: string;
  spotlightPadding?: number;
  showProgress?: boolean;
  allowSkip?: boolean;
  initialStepIndex?: number;
  zIndex?: number;
  allowInteractionWithinSpotlight?: boolean;
};

interface SpotlightState {
  targetRect: DOMRect | null;
  tooltipPosition: { x: number; y: number };
  tooltipPlacement: Placement;
  borderRadius: string;
  targetNotFound: boolean;
}

const TOOLTIP_WIDTH = 384;
const TOOLTIP_HEIGHT = 220;
const ANIMATION_DURATION = 0.4;

export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  steps,
  isOpen,
  onComplete,
  onSkip,
  onStepChange,
  overlayColor = 'rgba(0, 0, 0, 0.85)',
  spotlightPadding = 8,
  showProgress = true,
  allowSkip = true,
  initialStepIndex = 0,
  zIndex = 9999,
  allowInteractionWithinSpotlight = true,
}) => {
  const [currentStep, setCurrentStep] = useState(initialStepIndex);
  const [state, setState] = useState<SpotlightState>({
    targetRect: null,
    tooltipPosition: { x: 0, y: 0 },
    tooltipPlacement: 'bottom',
    borderRadius: '12px',
    targetNotFound: false,
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  const updatePosition = useCallback(() => {
    if (!isOpen || currentStep >= steps.length) return;

    const step = steps[currentStep];
    const target = resolveTarget(step.target);

    if (!target) {
      setState((prev) => ({
        ...prev,
        targetNotFound: true,
        targetRect: null,
      }));
      return;
    }

    if (!isElementVisible(target)) {
      scrollIntoViewIfNeeded(target, true);
      setTimeout(() => updatePosition(), 300);
      return;
    }

    const targetRect = getElementRect(target);
    const paddedRect = getPaddedRect(targetRect, spotlightPadding);
    const borderRadius = getBorderRadius(target);

    const { placement, position } = findBestPlacement(
      paddedRect,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT,
      step.placement
    );

    const clampedPosition = clampPositionToViewport(
      position,
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT
    );

    setState({
      targetRect: target.getBoundingClientRect(),
      tooltipPosition: clampedPosition,
      tooltipPlacement: placement,
      borderRadius,
      targetNotFound: false,
    });
  }, [isOpen, currentStep, steps, spotlightPadding]);

  const setupObservers = useCallback(
    (target: HTMLElement) => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }

      resizeObserverRef.current = new ResizeObserver(() => {
        updatePosition();
      });
      resizeObserverRef.current.observe(target);

      mutationObserverRef.current = new MutationObserver(() => {
        updatePosition();
      });
      mutationObserverRef.current.observe(target, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    },
    [updatePosition]
  );

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const step = steps[currentStep];
    const target = resolveTarget(step.target);
    if (target) {
      setupObservers(target);
    }

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    const timer = setTimeout(updatePosition, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeout(timer);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
      }
    };
  }, [isOpen, currentStep, steps, updatePosition, setupObservers]);

  useEffect(() => {
    if (isOpen && primaryButtonRef.current) {
      primaryButtonRef.current.focus();
    }
  }, [isOpen, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onComplete, onStepChange]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  }, [currentStep, onStepChange]);

  const handleSkip = useCallback(() => {
    if (allowSkip) {
      onSkip?.();
    }
  }, [allowSkip, onSkip]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleSkip();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentStep > 0) handlePrevious();
          break;
        case 'Tab':
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, handleNext, handlePrevious, handleSkip]);

  if (!isOpen) return null;

  const { targetRect, tooltipPosition, borderRadius, targetNotFound } = state;

  return (
    <AnimatePresence mode="wait">
      <div
        className="fixed inset-0"
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-title"
        aria-describedby="spotlight-description"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0"
          style={{
            backgroundColor: overlayColor,
            pointerEvents: allowInteractionWithinSpotlight ? 'none' : 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!allowInteractionWithinSpotlight) {
              handleSkip();
            }
          }}
        />

        {targetRect && !targetNotFound && (
          <motion.div
            key={`spotlight-${currentStep}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: ANIMATION_DURATION,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="absolute"
            style={{
              left: targetRect.left - spotlightPadding,
              top: targetRect.top - spotlightPadding,
              width: targetRect.width + spotlightPadding * 2,
              height: targetRect.height + spotlightPadding * 2,
              pointerEvents: allowInteractionWithinSpotlight ? 'auto' : 'none',
            }}
          >
            <div className="relative w-full h-full">
              <div
                className="absolute inset-0"
                style={{
                  borderRadius,
                  boxShadow: `0 0 0 9999px ${overlayColor}`,
                }}
              />

              <motion.div
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.015, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-0"
                style={{
                  borderRadius,
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #06b6d4)',
                  padding: '2px',
                  WebkitMask:
                    'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />

              <motion.div
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute -inset-3 blur-lg"
                style={{
                  borderRadius,
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #06b6d4)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </motion.div>
        )}

        <motion.div
          ref={tooltipRef}
          key={`tooltip-${currentStep}`}
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 8 }}
          transition={{
            duration: ANIMATION_DURATION,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="absolute"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            width: TOOLTIP_WIDTH,
            pointerEvents: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 opacity-75" />

            <div className="relative rounded-xl bg-background/95 backdrop-blur-xl border-0 shadow-2xl">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 pr-4">
                    {targetNotFound ? (
                      <>
                        <h3
                          id="spotlight-title"
                          className="text-lg font-semibold text-foreground mb-2"
                        >
                          Target Not Found
                        </h3>
                        <p
                          id="spotlight-description"
                          className="text-sm text-muted-foreground leading-relaxed"
                        >
                          The target element for this step could not be found. Please skip to continue.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3
                          id="spotlight-title"
                          className="text-lg font-semibold text-foreground mb-2"
                        >
                          {steps[currentStep]?.title}
                        </h3>
                        <p
                          id="spotlight-description"
                          className="text-sm text-muted-foreground leading-relaxed"
                        >
                          {steps[currentStep]?.description}
                        </p>
                      </>
                    )}
                  </div>
                  {allowSkip && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted shrink-0"
                      onClick={handleSkip}
                      aria-label="Skip tour"
                      data-testid="button-skip-tour"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between mt-6 gap-4">
                  {showProgress && (
                    <div className="flex items-center gap-1.5">
                      {steps.map((_, index) => (
                        <motion.div
                          key={index}
                          initial={false}
                          animate={{
                            width: index === currentStep ? 24 : 6,
                            backgroundColor:
                              index === currentStep
                                ? 'hsl(var(--primary))'
                                : index < currentStep
                                ? 'hsl(var(--primary) / 0.5)'
                                : 'hsl(var(--muted))',
                          }}
                          transition={{ duration: 0.3 }}
                          className="h-1.5 rounded-full"
                        />
                      ))}
                      <span className="ml-2 text-xs text-muted-foreground font-medium tabular-nums">
                        {currentStep + 1}/{steps.length}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 ml-auto">
                    {currentStep > 0 && !targetNotFound && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        className="gap-1"
                        aria-label="Previous step"
                        data-testid="button-tour-previous"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back
                      </Button>
                    )}
                    <Button
                      ref={primaryButtonRef}
                      size="sm"
                      onClick={handleNext}
                      className="gap-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                      aria-label={
                        currentStep === steps.length - 1 ? 'Finish tour' : 'Next step'
                      }
                      data-testid="button-tour-next"
                    >
                      {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                      {currentStep < steps.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SpotlightTour;
