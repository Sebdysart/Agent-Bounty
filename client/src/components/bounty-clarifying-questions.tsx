import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, MessageCircle, SkipForward, Check, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

interface ClarifyingQuestion {
  question: string;
  questionType: "text" | "choice" | "confirmation" | "number" | "date";
  options?: string[];
  isRequired?: boolean;
}

interface Props {
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

export function BountyClarifyingQuestions({ bountyData, onComplete, onSkip }: Props) {
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/bounties/analyze", bountyData);
      return response.json();
    },
    onSuccess: (data) => {
      setHasAnalyzed(true);
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        onComplete({});
      }
    },
    onError: () => {
      setHasAnalyzed(true);
      onComplete({});
    },
  });

  const handleAnswer = (answer: string) => {
    const question = questions[currentIndex];
    setAnswers({ ...answers, [question.question]: answer });
    
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete({ ...answers, [question.question]: answer });
    }
  };

  const handleSkipQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete(answers);
    }
  };

  if (!hasAnalyzed) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5" />
        <CardHeader className="relative text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Analysis
          </CardTitle>
          <CardDescription>
            Let our AI analyze your bounty to identify any missing details
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This helps agents better understand your requirements and deliver higher quality results.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                data-testid="button-analyze-bounty"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze Bounty
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={onSkip} data-testid="button-skip-analysis">
                Skip
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-violet-500" />
            Clarifying Questions
          </CardTitle>
          <Badge variant="outline">
            {currentIndex + 1} / {questions.length}
          </Badge>
        </div>
        <CardDescription>
          Help agents understand your bounty better
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-violet-500 mt-1 shrink-0" />
              <p className="text-sm font-medium">{currentQuestion.question}</p>
              {currentQuestion.isRequired && (
                <Badge variant="secondary" className="ml-auto shrink-0">Required</Badge>
              )}
            </div>

            <QuestionInput
              question={currentQuestion}
              value={answers[currentQuestion.question] || ""}
              onChange={handleAnswer}
            />
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-4 border-t">
          {!currentQuestion.isRequired ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipQuestion}
              data-testid="button-skip-question"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex
                    ? "bg-violet-500"
                    : i < currentIndex
                    ? "bg-violet-500/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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
            <div key={i} className="flex items-center space-x-2">
              <RadioGroupItem
                value={option}
                id={`option-${i}`}
                data-testid={`radio-option-${i}`}
              />
              <Label htmlFor={`option-${i}`} className="cursor-pointer">
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
            data-testid="input-date"
          />
          <Button onClick={handleSubmit} disabled={!inputValue} data-testid="button-submit-answer">
            Submit
          </Button>
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            className="min-h-[80px] resize-y"
            data-testid="input-text-answer"
          />
          <Button 
            onClick={handleSubmit} 
            disabled={!inputValue.trim()} 
            className="w-full"
            data-testid="button-submit-answer"
          >
            Submit Answer
          </Button>
        </div>
      );
  }
}
