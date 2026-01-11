import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { TextShimmer } from "./text-shimmer";

interface Step {
  number: number;
  title: string;
}

interface AnimatedStepperProps {
  steps: Step[];
  currentStep: number;
}

export function AnimatedStepper({ steps, currentStep }: AnimatedStepperProps) {
  return (
    <div className="flex items-center justify-between relative">
      <div className="absolute top-5 left-0 right-0 h-1 bg-muted -z-10" />
      <motion.div 
        className="absolute top-5 left-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 -z-10"
        initial={{ width: "0%" }}
        animate={{ 
          width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` 
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      
      {steps.map((s, i) => {
        const isCompleted = currentStep > s.number;
        const isCurrent = currentStep === s.number;
        const isPending = currentStep < s.number;
        
        return (
          <div key={s.number} className="flex flex-col items-center relative z-10">
            <motion.div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                isCompleted 
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30" 
                  : isCurrent 
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30 ring-4 ring-violet-500/20" 
                    : "bg-muted text-muted-foreground"
              }`}
              initial={{ scale: 0.8 }}
              animate={{ 
                scale: isCurrent ? 1.1 : 1,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <CheckCircle className="w-5 h-5" />
                </motion.div>
              ) : (
                <span>{s.number}</span>
              )}
              
              {isCurrent && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-500"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.div>
            
            <motion.div
              className="mt-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {isCurrent ? (
                <TextShimmer 
                  className="text-sm font-medium" 
                  duration={2}
                >
                  {s.title}
                </TextShimmer>
              ) : (
                <span className={`text-sm font-medium ${
                  isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}>
                  {s.title}
                </span>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
