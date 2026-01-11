import { motion } from "framer-motion";
import { 
  DollarSign, 
  Bot, 
  FileText, 
  CheckCircle2, 
  Zap,
  Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export type ActivityType = 
  | 'bounty_created' 
  | 'bounty_funded' 
  | 'bounty_completed' 
  | 'agent_registered' 
  | 'submission_created' 
  | 'payment_released';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  actorName?: string;
  actorAvatar?: string;
  metadata?: Record<string, any>;
  createdAt: Date | string;
}

interface NeonActivityItemProps {
  activity: Activity;
  index?: number;
}

const activityConfig: Record<ActivityType, {
  icon: typeof DollarSign;
  gradient: string;
  borderColor: string;
  label: string;
}> = {
  bounty_created: {
    icon: FileText,
    gradient: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/30",
    label: "New Bounty",
  },
  bounty_funded: {
    icon: DollarSign,
    gradient: "from-emerald-500 to-green-600",
    borderColor: "border-emerald-500/30",
    label: "Funded",
  },
  bounty_completed: {
    icon: CheckCircle2,
    gradient: "from-cyan-500 to-blue-600",
    borderColor: "border-cyan-500/30",
    label: "Completed",
  },
  agent_registered: {
    icon: Bot,
    gradient: "from-fuchsia-500 to-pink-600",
    borderColor: "border-fuchsia-500/30",
    label: "New Agent",
  },
  submission_created: {
    icon: Send,
    gradient: "from-amber-500 to-orange-600",
    borderColor: "border-amber-500/30",
    label: "Submission",
  },
  payment_released: {
    icon: Zap,
    gradient: "from-lime-500 to-emerald-600",
    borderColor: "border-lime-500/30",
    label: "Payment",
  },
};

export function NeonActivityItem({ activity, index = 0 }: NeonActivityItemProps) {
  const config = activityConfig[activity.type];
  const Icon = config.icon;
  const createdAt = typeof activity.createdAt === 'string' 
    ? new Date(activity.createdAt) 
    : activity.createdAt;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={`
        relative group p-3 rounded-lg
        bg-background/40 backdrop-blur-sm
        border ${config.borderColor}
        hover-elevate cursor-pointer
        transition-all duration-200
      `}
      data-testid={`activity-item-${activity.id}`}
    >
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-5 rounded-lg`} />
      </div>

      <div className="relative flex items-start gap-3">
        <div className={`
          flex-shrink-0 w-9 h-9 rounded-lg
          bg-gradient-to-br ${config.gradient}
          flex items-center justify-center
          shadow-lg shadow-current/20
        `}>
          <Icon className="w-4 h-4 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`
              text-[10px] font-medium uppercase tracking-wider
              bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent
            `}>
              {config.label}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>
          
          <h4 className="text-sm font-medium text-foreground truncate">
            {activity.title}
          </h4>
          
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {activity.description}
          </p>

          {activity.amount !== undefined && activity.amount > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-500">
                {activity.amount.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.05 + 0.2 }}
          className={`
            w-2 h-2 rounded-full
            bg-gradient-to-r ${config.gradient}
            shadow-lg shadow-current/50
          `}
        />
      </div>
    </motion.div>
  );
}
