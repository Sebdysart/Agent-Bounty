"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  Paperclip,
  Code2,
  Rocket,
  Layers,
  Target,
  BarChart3,
  FileText,
  Zap,
  Brain,
  Search,
  Database,
  Palette,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    minHeight: 56,
    maxHeight: 160,
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
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
      
      <motion.div 
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <TextShimmer 
          className="text-4xl font-bold font-display tracking-tight"
          duration={3}
        >
          AI Task Builder
        </TextShimmer>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">
          Describe your task and let AI generate a complete bounty specification with success metrics.
        </p>
      </motion.div>

      <motion.div 
        className="w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-violet-500/5 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
          
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
              "w-full px-5 py-4 resize-none border-none",
              "bg-transparent text-foreground text-base",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/60 min-h-[56px]"
            )}
            style={{ overflow: "hidden" }}
            data-testid="input-ai-task-prompt"
          />

          <div className="flex items-center justify-between p-3 border-t border-border/30">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
              data-testid="button-attach-file"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                  >
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-sm font-medium">Generating...</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="button"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Button
                      onClick={handleSubmit}
                      disabled={!message.trim()}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
                        message.trim()
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white shadow-lg shadow-violet-500/25"
                          : "bg-muted text-muted-foreground"
                      )}
                      data-testid="button-generate-bounty"
                    >
                      <ArrowUpIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">Generate</span>
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <motion.div 
          className="flex items-center justify-center flex-wrap gap-2.5 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <QuickAction 
            icon={<BarChart3 className="w-4 h-4" />} 
            label="Data Analysis" 
            onClick={() => handleQuickAction("I need an AI agent to analyze my sales data and identify trends, patterns, and growth opportunities")}
          />
          <QuickAction 
            icon={<FileText className="w-4 h-4" />} 
            label="Content Creation" 
            onClick={() => handleQuickAction("Create an AI agent that generates blog posts and social media content based on my brand guidelines")}
          />
          <QuickAction 
            icon={<Search className="w-4 h-4" />} 
            label="Research" 
            onClick={() => handleQuickAction("Build an agent to research competitors and create comprehensive market analysis reports")}
          />
          <QuickAction 
            icon={<Target className="w-4 h-4" />} 
            label="Lead Generation" 
            onClick={() => handleQuickAction("I need an AI agent to identify and qualify potential leads from various data sources")}
          />
          <QuickAction 
            icon={<Code2 className="w-4 h-4" />} 
            label="Code Review" 
            onClick={() => handleQuickAction("Create an agent that reviews code for bugs, security issues, and optimization opportunities")}
          />
          <QuickAction 
            icon={<Brain className="w-4 h-4" />} 
            label="Customer Support" 
            onClick={() => handleQuickAction("Build an AI agent to handle customer inquiries and provide automated support responses")}
          />
          <QuickAction 
            icon={<Database className="w-4 h-4" />} 
            label="Data Processing" 
            onClick={() => handleQuickAction("I need an agent to clean, transform, and process large datasets automatically")}
          />
          <QuickAction 
            icon={<Globe className="w-4 h-4" />} 
            label="Web Scraping" 
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
  onClick: () => void;
}

function QuickAction({ icon, label, onClick }: QuickActionProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Button
        variant="outline"
        onClick={onClick}
        className="flex items-center gap-2 rounded-full border-border/50 bg-card/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-card hover:border-violet-500/30 transition-all"
        data-testid={`button-quick-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </Button>
    </motion.div>
  );
}
