import { useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, Key, Sparkles, ShieldCheck, MessageSquareText } from 'lucide-react'

interface AIFeatureShowcaseProps {
  variant?: 'clarifying-questions' | 'credentials'
}

export function AIFeatureShowcase({ variant = 'clarifying-questions' }: AIFeatureShowcaseProps) {
  const [isHovered, setIsHovered] = useState(false)

  const features = {
    'clarifying-questions': {
      icon: MessageSquareText,
      title: 'AI Clarifying Questions',
      description: 'GPT-4o analyzes your bounty requirements and generates smart questions to gather missing details, ensuring agents have all the information they need.',
      gradient: 'from-violet-400 to-fuchsia-500',
      iconBg: 'from-violet-500 to-fuchsia-500',
      features: [
        'Auto-detects missing information',
        'Multiple question types',
        'Improves bounty quality'
      ]
    },
    'credentials': {
      icon: Key,
      title: 'Secure Credential Consent',
      description: 'Share login credentials securely with agents. Credentials are stored in encrypted memory only and never persisted to any database.',
      gradient: 'from-cyan-400 to-blue-500',
      iconBg: 'from-cyan-500 to-blue-500',
      features: [
        'Session-only storage',
        'Full audit logging',
        'One-click revocation'
      ]
    }
  }

  const config = features[variant]
  const Icon = config.icon

  return (
    <motion.div 
      className='min-h-[380px] w-[320px] bg-black/80 backdrop-blur-xl rounded-3xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col p-4 gap-3 overflow-hidden border border-white/10'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      whileHover={{ 
        scale: 1.02,
        boxShadow: "0 35px 60px -15px rgba(0,0,0,0.7)",
        borderColor: "rgba(255,255,255,0.2)"
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      data-testid={`showcase-${variant}`}
    >
      <motion.div 
        className='flex justify-between items-center'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <motion.div 
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.iconBg} flex items-center justify-center shadow-lg`}
          whileHover={{ rotate: 10, scale: 1.1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className="w-6 h-6 text-white" />
        </motion.div>
        <motion.div 
          className='w-10 h-10 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center cursor-pointer'
          whileHover={{ 
            scale: 1.1, 
            boxShadow: "0 0 15px rgba(139, 92, 246, 0.7)" 
          }}
          whileTap={{ scale: 0.95 }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </motion.div>
      </motion.div>

      <motion.div 
        className={`text-2xl font-bold bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {config.title}
      </motion.div>

      <motion.div 
        className="text-sm text-neutral-400 leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.7 }}
      >
        {config.description}
      </motion.div>

      <motion.div 
        className="mt-2 space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {config.features.map((feature, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-2 text-sm"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-neutral-300">{feature}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className={`mt-auto pt-4 rounded-xl bg-gradient-to-r ${config.iconBg} p-[1px]`}
        animate={{ 
          scale: isHovered ? 1.02 : 1,
          boxShadow: isHovered ? "0 0 20px rgba(139, 92, 246, 0.3)" : "none"
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-black/90 rounded-xl px-4 py-3 flex items-center gap-3">
          <Brain className="w-5 h-5 text-violet-400" />
          <span className="text-xs text-neutral-300">Powered by GPT-4o</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function AIFeaturesSection() {
  return (
    <section className="py-16 relative">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 
            className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            AI-Powered Features
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our platform leverages cutting-edge AI to streamline bounty creation and secure credential management
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-8">
          <AIFeatureShowcase variant="clarifying-questions" />
          <AIFeatureShowcase variant="credentials" />
        </div>
      </div>
    </section>
  )
}
