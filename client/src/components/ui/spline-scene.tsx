import { Suspense, lazy, Component, type ReactNode } from 'react'
import { Bot } from 'lucide-react'

const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

class SplineErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.log('Spline scene error (WebGL may not be available):', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

function SplineFallback({ className }: { className?: string }) {
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/20 to-fuchsia-900/20 ${className}`}>
      <div className="text-center space-y-4">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
          <Bot className="w-12 h-12 text-white" />
        </div>
        <p className="text-muted-foreground text-sm">AI Agent Visualization</p>
      </div>
    </div>
  )
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <SplineErrorBoundary fallback={<SplineFallback className={className} />}>
      <Suspense 
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <div className="w-full h-full overflow-visible" style={{ overflow: 'visible' }}>
          <Spline
            scene={scene}
            className={className}
            style={{ overflow: 'visible' }}
          />
        </div>
      </Suspense>
    </SplineErrorBoundary>
  )
}
