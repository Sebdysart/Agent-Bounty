import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, MessageCircle, SkipForward, Check, AlertCircle, Brain, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface ClarifyingQuestion {
  question: string;
  questionType: "text" | "choice" | "confirmation" | "number" | "date";
  options?: string[];
  isRequired?: boolean;
}

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  bountyData: {
    title?: string;
    description?: string;
    requirements?: string;
    reward?: string;
    category?: string;
  };
  onComplete: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function ClarifyingQuestionsModal({ isOpen, onOpenChange, bountyData, onComplete, onSkip }: Props) {
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"intro" | "analyzing" | "questions" | "complete">("intro");

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bounties/analyze", bountyData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setPhase("questions");
      } else {
        setPhase("complete");
        setTimeout(() => {
          onComplete({});
          onOpenChange(false);
        }, 1500);
      }
    },
    onError: () => {
      setPhase("complete");
      setTimeout(() => {
        onComplete({});
        onOpenChange(false);
      }, 1500);
    },
  });

  const handleStartAnalysis = () => {
    setPhase("analyzing");
    analyzeMutation.mutate();
  };

  const handleAnswer = (answer: string) => {
    const question = questions[currentIndex];
    const newAnswers = { ...answers, [question.question]: answer };
    setAnswers(newAnswers);
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(newAnswers);
      onOpenChange(false);
    }
  };

  const handleSkipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(answers);
      onOpenChange(false);
    }
  };

  const handleSkipAll = () => {
    onSkip();
    onOpenChange(false);
  };

  const currentQuestion = questions[currentIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background/95 backdrop-blur-xl border-violet-500/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative"
            >
              <DialogHeader className="text-center pb-2">
                <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <DialogTitle className="text-xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  AI Bounty Analysis
                </DialogTitle>
                <DialogDescription className="text-base">
                  Let our AI identify any missing details that could help agents deliver better results
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{bountyData.title || "Your Bounty"}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {bountyData.description?.slice(0, 100)}...
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  This quick analysis helps ensure your bounty has all the details agents need to succeed.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleStartAnalysis}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  data-testid="button-start-analysis"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze My Bounty
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSkipAll}
                  className="w-full text-muted-foreground"
                  data-testid="button-skip-analysis"
                >
                  Skip Analysis
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative py-8 text-center"
            >
              <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-10 h-10 text-violet-500" />
                </motion.div>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Analyzing Your Bounty
              </h3>
              <p className="text-sm text-muted-foreground">
                Our AI is reviewing your requirements...
              </p>
              <div className="mt-6 flex justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-violet-500"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {phase === "questions" && currentQuestion && (
            <motion.div
              key={`question-${currentIndex}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="relative"
            >
              <DialogHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-violet-500/20">
                      <MessageCircle className="w-4 h-4 text-violet-400" />
                    </div>
                    <DialogTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Quick Question
                    </DialogTitle>
                  </div>
                  <Badge variant="outline" className="border-violet-500/30 text-violet-400">
                    {currentIndex + 1} / {questions.length}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-2">
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{currentQuestion.question}</p>
                      {currentQuestion.isRequired && (
                        <Badge variant="secondary" className="mt-2">Required</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <QuestionInput
                  question={currentQuestion}
                  value={answers[currentQuestion.question] || ""}
                  onChange={handleAnswer}
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/30">
                {!currentQuestion.isRequired ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipQuestion}
                    className="text-muted-foreground"
                    data-testid="button-skip-question"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-1.5">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === currentIndex
                          ? "bg-violet-500 scale-125"
                          : i < currentIndex
                          ? "bg-violet-500/50"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative py-8 text-center"
            >
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                All Set!
              </h3>
              <p className="text-sm text-muted-foreground">
                Your bounty looks complete. No additional info needed.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: ClarifyingQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const [inputValue, setInputValue] = useState(value);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onChange(inputValue.trim());
    }
  };

  switch (question.questionType) {
    case "choice":
      return (
        <RadioGroup
          value={value}
          onValueChange={onChange}
          className="space-y-2"
        >
          {question.options?.map((option, i) => (
            <div key={i} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <RadioGroupItem
                value={option}
                id={`option-${i}`}
                data-testid={`radio-option-${i}`}
              />
              <Label htmlFor={`option-${i}`} className="cursor-pointer flex-1">
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );

    case "confirmation":
      return (
        <div className="flex gap-3">
          <Button
            variant={value === "Yes" ? "default" : "outline"}
            onClick={() => onChange("Yes")}
            className="flex-1"
            data-testid="button-yes"
          >
            <Check className="w-4 h-4 mr-2" />
            Yes
          </Button>
          <Button
            variant={value === "No" ? "default" : "outline"}
            onClick={() => onChange("No")}
            className="flex-1"
            data-testid="button-no"
          >
            No
          </Button>
        </div>
      );

    case "number":
      return (
        <div className="flex gap-2">
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter a number"
            className="flex-1"
            data-testid="input-number"
          />
          <Button onClick={handleSubmit} disabled={!inputValue} data-testid="button-submit-answer">
            Submit
          </Button>
        </div>
      );

    case "date":
      return (
        <div className="flex gap-2">
          <Input
            type="date"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            data-testid="input-date"
          />
          <Button onClick={handleSubmit} disabled={!inputValue} data-testid="button-submit-answer">
            Submit
          </Button>
        </div>
      );

    default:
      return (
        <div className="space-y-3">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            className="min-h-[100px] resize-y bg-muted/30"
            data-testid="input-text-answer"
          />
          <Button 
            onClick={handleSubmit} 
            disabled={!inputValue.trim()} 
            className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            data-testid="button-submit-answer"
          >
            Submit Answer
          </Button>
        </div>
      );
  }
}
