import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Sparkles, Code, FileJson } from 'lucide-react'

interface ShowcaseCardProps {
  title: string
  subtitle?: string
  description: string
  icon?: React.ReactNode
  imageUrl?: string
  variant?: 'violet' | 'fuchsia' | 'cyan'
  onClick?: () => void
  badge?: string
}

export function ShowcaseCard({
  title,
  subtitle,
  description,
  icon,
  imageUrl,
  variant = 'violet',
  onClick,
  badge
}: ShowcaseCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const gradientColors = {
    violet: 'from-violet-500 via-violet-400 to-fuchsia-500',
    fuchsia: 'from-fuchsia-500 via-fuchsia-400 to-cyan-500',
    cyan: 'from-cyan-500 via-cyan-400 to-violet-500'
  }

  const glowColors = {
    violet: 'rgba(139, 92, 246, 0.4)',
    fuchsia: 'rgba(217, 70, 239, 0.4)',
    cyan: 'rgba(34, 211, 238, 0.4)'
  }

  const borderGlow = {
    violet: 'border-violet-500/30 hover:border-violet-400/50',
    fuchsia: 'border-fuchsia-500/30 hover:border-fuchsia-400/50',
    cyan: 'border-cyan-500/30 hover:border-cyan-400/50'
  }

  return (
    <motion.div
      className={`relative min-h-[360px] w-full max-w-[280px] bg-card/90 backdrop-blur-xl rounded-2xl border ${borderGlow[variant]} flex flex-col p-5 gap-4 overflow-hidden cursor-pointer group transition-colors duration-300`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        boxShadow: isHovered ? `0 20px 40px -15px ${glowColors[variant]}` : 'none'
      }}
    >
      <motion.div
        className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${gradientColors[variant]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />
      
      <div className="flex justify-between items-center">
        <motion.div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientColors[variant]} flex items-center justify-center shadow-lg`}
          whileHover={{ scale: 1.05, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          {icon || <Sparkles className="w-6 h-6 text-white" />}
        </motion.div>

        {badge && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {badge}
          </span>
        )}

        <motion.div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradientColors[variant]} flex items-center justify-center shadow-md`}
          whileHover={{
            scale: 1.1,
            boxShadow: `0 0 20px ${glowColors[variant]}`
          }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowUpRight className="w-4 h-4 text-white" />
        </motion.div>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h3 className={`text-2xl font-bold font-display bg-gradient-to-r ${gradientColors[variant]} bg-clip-text text-transparent leading-tight`}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-lg font-semibold text-foreground/80 mt-1">
              {subtitle}
            </p>
          )}
        </motion.div>

        {imageUrl && (
          <motion.div
            className="relative rounded-xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.img
              src={imageUrl}
              alt={title}
              className="w-full h-32 object-cover rounded-xl"
              animate={{ scale: isHovered ? 1.05 : 1 }}
              transition={{ duration: 0.4 }}
            />
            <div className={`absolute inset-0 bg-gradient-to-t from-card/80 to-transparent`} />
          </motion.div>
        )}

        <motion.p
          className="text-sm text-muted-foreground leading-relaxed mt-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {description}
        </motion.p>
      </div>

      <div className={`absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-to-br ${gradientColors[variant]} rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500`} />
    </motion.div>
  )
}

interface UploadMethodCardProps {
  type: 'no_code' | 'low_code' | 'full_code'
  selected?: boolean
  onSelect?: () => void
}

export function UploadMethodCard({ type, selected, onSelect }: UploadMethodCardProps) {
  const config = {
    no_code: {
      icon: <Sparkles className="w-6 h-6 text-white" />,
      title: 'No-Code',
      description: 'Describe your agent in plain language',
      features: ['Natural language input', 'AI generates config', 'Ready in minutes'],
      badge: 'Best for beginners',
      variant: 'violet' as const
    },
    low_code: {
      icon: <FileJson className="w-6 h-6 text-white" />,
      title: 'Low-Code',
      description: 'Import JSON manifest or use visual editor',
      features: ['JSON/YAML import', 'Visual configuration', 'Flexible customization'],
      badge: 'Intermediate users',
      variant: 'fuchsia' as const
    },
    full_code: {
      icon: <Code className="w-6 h-6 text-white" />,
      title: 'Full-Code',
      description: 'Connect Git repository or upload code',
      features: ['Git integration', 'Custom frameworks', 'Full control'],
      badge: 'Advanced developers',
      variant: 'cyan' as const
    }
  }

  const { icon, title, description, features, badge, variant } = config[type]

  const gradientColors = {
    violet: 'from-violet-500 via-violet-400 to-fuchsia-500',
    fuchsia: 'from-fuchsia-500 via-fuchsia-400 to-cyan-500',
    cyan: 'from-cyan-500 via-cyan-400 to-violet-500'
  }

  const borderStyles = selected
    ? 'border-primary ring-2 ring-primary/20'
    : 'border-border/50 hover:border-primary/50'

  return (
    <motion.div
      className={`relative bg-card/80 backdrop-blur-sm rounded-2xl border ${borderStyles} p-6 cursor-pointer transition-all duration-200`}
      onClick={onSelect}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {selected && (
        <motion.div
          className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${gradientColors[variant]}`}
          layoutId="selected-border"
        />
      )}

      <div className="flex flex-col items-center text-center gap-4">
        <motion.div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientColors[variant]} flex items-center justify-center shadow-lg`}
          whileHover={{ scale: 1.05, rotate: 3 }}
        >
          {icon}
        </motion.div>

        <div>
          <h3 className="text-xl font-bold font-display text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>

        <ul className="space-y-2 w-full">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${gradientColors[variant]} flex items-center justify-center`}>
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              {feature}
            </li>
          ))}
        </ul>

        <span className={`text-xs font-medium px-3 py-1.5 rounded-full bg-card border border-border/50 text-muted-foreground mt-2`}>
          {badge}
        </span>
      </div>
    </motion.div>
  )
}
