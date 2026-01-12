import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AnimatedGenerateButton } from "@/components/ui/animated-generate-button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Paperclip,
  Code2,
  Target,
  BarChart3,
  FileText,
  Brain,
  Search,
  Database,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import { TextShimmer } from "@/components/ui/text-shimmer";

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

interface AITaskChatProps {
  onSubmit: (prompt: string) => void;
  isGenerating?: boolean;
}

export function AITaskChat({ onSubmit, isGenerating = false }: AITaskChatProps) {
  const [message, setMessage] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 64,
    maxHeight: 180,
  });

  const handleSubmit = () => {
    if (message.trim() && !isGenerating) {
      onSubmit(message.trim());
    }
  };

  const handleQuickAction = (prompt: string) => {
    setMessage(prompt);
    adjustHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-fuchsia-500/10 pointer-events-none blur-3xl" />
      
      <motion.div 
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-violet-500/30 mb-6">
          <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
          <span className="text-sm font-medium text-violet-400">AI-Powered Generation</span>
        </div>
        <h2 
          className="text-4xl md:text-5xl font-bold tracking-tight gradient-text"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Describe Your Task
        </h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto">
          Let AI generate a complete bounty specification with success metrics.
        </p>
      </motion.div>

      <motion.div 
        className="w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-violet-500/50 via-fuchsia-500/50 to-cyan-500/50 shadow-2xl shadow-violet-500/20">
          <div className="relative rounded-2xl bg-card/95 backdrop-blur-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
            
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe your bounty task... e.g., 'I need an AI agent to analyze customer reviews and generate weekly sentiment reports'"
              className={cn(
                "w-full px-6 py-5 resize-none border-none",
                "bg-transparent text-foreground text-base leading-relaxed",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-muted-foreground/50 min-h-[64px]"
              )}
              style={{ overflow: "hidden" }}
              data-testid="input-ai-task-prompt"
            />

            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30 bg-muted/20">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                data-testid="button-attach-file"
              >
                <Paperclip className="w-5 h-5" />
              </Button>

              <AnimatedGenerateButton
                onClick={handleSubmit}
                highlightHueDeg={280}
                className={cn(
                  "transition-all duration-300",
                  !message.trim() && "opacity-50"
                )}
                disabled={!message.trim() || isGenerating}
                data-testid="button-generate-bounty"
              >
                {isGenerating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate</span>
                  </>
                )}
              </AnimatedGenerateButton>
            </div>
          </div>
        </div>

        <motion.div 
          className="flex items-center justify-center flex-wrap gap-3 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <QuickAction 
            icon={<BarChart3 className="w-4 h-4" />} 
            label="Data Analysis" 
            color="violet"
            onClick={() => handleQuickAction("I need an AI agent to analyze my sales data and identify trends, patterns, and growth opportunities")}
          />
          <QuickAction 
            icon={<FileText className="w-4 h-4" />} 
            label="Content Creation" 
            color="fuchsia"
            onClick={() => handleQuickAction("Create an AI agent that generates blog posts and social media content based on my brand guidelines")}
          />
          <QuickAction 
            icon={<Search className="w-4 h-4" />} 
            label="Research" 
            color="cyan"
            onClick={() => handleQuickAction("Build an agent to research competitors and create comprehensive market analysis reports")}
          />
          <QuickAction 
            icon={<Target className="w-4 h-4" />} 
            label="Lead Generation" 
            color="emerald"
            onClick={() => handleQuickAction("I need an AI agent to identify and qualify potential leads from various data sources")}
          />
          <QuickAction 
            icon={<Code2 className="w-4 h-4" />} 
            label="Code Review" 
            color="amber"
            onClick={() => handleQuickAction("Create an agent that reviews code for bugs, security issues, and optimization opportunities")}
          />
          <QuickAction 
            icon={<Brain className="w-4 h-4" />} 
            label="Customer Support" 
            color="violet"
            onClick={() => handleQuickAction("Build an AI agent to handle customer inquiries and provide automated support responses")}
          />
          <QuickAction 
            icon={<Database className="w-4 h-4" />} 
            label="Data Processing" 
            color="cyan"
            onClick={() => handleQuickAction("I need an agent to clean, transform, and process large datasets automatically")}
          />
          <QuickAction 
            icon={<Globe className="w-4 h-4" />} 
            label="Web Scraping" 
            color="fuchsia"
            onClick={() => handleQuickAction("Create an agent that scrapes and aggregates data from specified websites")}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  color: "violet" | "fuchsia" | "cyan" | "emerald" | "amber";
  onClick: () => void;
}

function QuickAction({ icon, label, color, onClick }: QuickActionProps) {
  const colorClasses = {
    violet: "hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-400 hover:shadow-violet-500/20",
    fuchsia: "hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:shadow-fuchsia-500/20",
    cyan: "hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400 hover:shadow-cyan-500/20",
    emerald: "hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:shadow-emerald-500/20",
    amber: "hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400 hover:shadow-amber-500/20",
  };

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Button
        variant="outline"
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 h-auto",
          "border-border/50 bg-card/60 backdrop-blur-sm text-muted-foreground",
          "transition-all duration-300 shadow-lg shadow-transparent",
          colorClasses[color]
        )}
        data-testid={`button-quick-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </Button>
    </motion.div>
  );
}
