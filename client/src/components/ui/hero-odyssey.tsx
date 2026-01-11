import { useState, useRef, useEffect, memo } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import { TextShimmer } from "./text-shimmer";
import { AnimatedGenerateButton } from "./animated-generate-button";
import { Sparkles, Zap, ArrowRight } from "lucide-react";

interface LightningCanvasProps {
  className?: string;
  intensity?: number;
}

const LightningCanvas = memo(function LightningCanvas({ className, intensity = 0.5 }: LightningCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isWebGLSupported, setIsWebGLSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsWebGLSupported(false);
      return;
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const bolts: { points: { x: number; y: number }[]; alpha: number; hue: number }[] = [];

    const createBolt = () => {
      const startX = Math.random() * canvas.offsetWidth;
      const points = [{ x: startX, y: 0 }];
      let currentX = startX;
      let currentY = 0;
      const segments = 8 + Math.floor(Math.random() * 8);

      for (let i = 0; i < segments; i++) {
        currentX += (Math.random() - 0.5) * 60;
        currentY += canvas.offsetHeight / segments;
        points.push({ x: currentX, y: currentY });
      }

      bolts.push({
        points,
        alpha: 0.8 + Math.random() * 0.2,
        hue: 250 + Math.random() * 60,
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      if (Math.random() < 0.02 * intensity && bolts.length < 3) {
        createBolt();
      }

      for (let i = bolts.length - 1; i >= 0; i--) {
        const bolt = bolts[i];
        bolt.alpha -= 0.03;

        if (bolt.alpha <= 0) {
          bolts.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.strokeStyle = `hsla(${bolt.hue}, 80%, 70%, ${bolt.alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = `hsla(${bolt.hue}, 80%, 60%, ${bolt.alpha})`;
        ctx.shadowBlur = 10;

        ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
        for (let j = 1; j < bolt.points.length; j++) {
          ctx.lineTo(bolt.points[j].x, bolt.points[j].y);
        }
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.shadowBlur = 20;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity]);

  if (!isWebGLSupported) {
    return (
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent",
          className
        )}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{ width: "100%", height: "100%" }}
    />
  );
});

interface ElasticHueSliderProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

function ElasticHueSlider({ value, onChange, className }: ElasticHueSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });

  const handleMove = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newValue = (newX / rect.width) * 360;
    onChange(newValue);
  };

  const handleMouseDown = (e: { clientX: number }) => {
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (sliderRef.current) {
      const width = sliderRef.current.offsetWidth;
      x.set((value / 360) * width);
    }
  }, [value, x]);

  return (
    <div
      ref={sliderRef}
      className={cn(
        "relative h-3 rounded-full cursor-pointer",
        "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500",
        className
      )}
      onMouseDown={handleMouseDown}
      data-testid="slider-hue"
    >
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing"
        style={{
          x: springX,
          backgroundColor: `hsl(${value}, 80%, 50%)`,
          boxShadow: `0 0 10px hsl(${value}, 80%, 50%)`,
        }}
      >
        <div className="absolute inset-1 rounded-full bg-white/30" />
      </motion.div>
    </div>
  );
}

interface HeroSectionProps {
  className?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  showLightning?: boolean;
  showHueSlider?: boolean;
}

export function HeroSection({
  className,
  title = "Build AI-Powered Applications",
  subtitle = "Create stunning interfaces with our component library",
  ctaText = "Get Started",
  onCtaClick,
  showLightning = true,
  showHueSlider = true,
}: HeroSectionProps) {
  const [hue, setHue] = useState(280);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
    onCtaClick?.();
  };

  return (
    <section
      className={cn(
        "relative min-h-[600px] w-full overflow-hidden",
        "bg-gradient-to-b from-background via-background to-muted/30",
        className
      )}
      data-testid="hero-odyssey"
    >
      {showLightning && <LightningCanvas intensity={0.7} />}

      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, hsl(${hue} 80% 50% / 0.15), transparent 50%)`,
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-20 flex flex-col items-center justify-center min-h-[600px] text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <TextShimmer className="text-sm font-medium text-primary">
              Premium UI Components
            </TextShimmer>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {title.split(" ").slice(0, -2).join(" ")}{" "}
            </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 60) % 360} 80% 50%))`,
              }}
            >
              {title.split(" ").slice(-2).join(" ")}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {subtitle}
          </p>

          {showHueSlider && (
            <div className="w-full max-w-xs mx-auto pt-4">
              <p className="text-xs text-muted-foreground mb-2">Customize theme color</p>
              <ElasticHueSlider value={hue} onChange={setHue} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <AnimatedGenerateButton
              generating={generating}
              onClick={handleGenerate}
              highlightHueDeg={hue}
            >
              <Zap className="w-4 h-4" />
              {ctaText}
            </AnimatedGenerateButton>

            <motion.button
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-muted-foreground hover:text-foreground transition-colors"
              whileHover={{ x: 5 }}
              data-testid="button-learn-more"
            >
              Learn More
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px"
          style={{
            background: `linear-gradient(90deg, transparent, hsl(${hue} 80% 50% / 0.5), transparent)`,
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        />
      </div>
    </section>
  );
}

export default HeroSection;
