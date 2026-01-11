import { useState, useEffect, useRef, type ReactNode } from 'react';

interface RippleType {
  id: number;
  x: number;
  y: number;
}

interface AnimatedBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedBackground({ children, className = '' }: AnimatedBackgroundProps) {
  const [mouseGradientStyle, setMouseGradientStyle] = useState({
    left: '0px',
    top: '0px',
    opacity: 0,
  });
  const [ripples, setRipples] = useState<RippleType[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const floatingElementsRef = useRef<Element[]>([]);

  useEffect(() => {
    const animateWords = () => {
      const wordElements = document.querySelectorAll('.word-animate');
      wordElements.forEach(word => {
        const delay = parseInt(word.getAttribute('data-delay') || '0') || 0;
        setTimeout(() => {
          if (word) (word as HTMLElement).style.animation = 'word-appear 0.8s ease-out forwards';
        }, delay);
      });
    };
    const timeoutId = setTimeout(animateWords, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseGradientStyle({
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
        opacity: 1,
      });
    };
    const handleMouseLeave = () => {
      setMouseGradientStyle(prev => ({ ...prev, opacity: 0 }));
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const newRipple = { id: Date.now(), x: e.clientX, y: e.clientY };
      setRipples(prev => [...prev, newRipple]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== newRipple.id)), 1000);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  
  useEffect(() => {
    const wordElements = document.querySelectorAll('.word-animate');
    const handleMouseEnter = (e: Event) => { 
      const target = e.target as HTMLElement;
      if (target) target.style.textShadow = '0 0 20px rgba(139, 92, 246, 0.5)'; 
    };
    const handleMouseLeave = (e: Event) => { 
      const target = e.target as HTMLElement;
      if (target) target.style.textShadow = 'none'; 
    };
    wordElements.forEach(word => {
      word.addEventListener('mouseenter', handleMouseEnter);
      word.addEventListener('mouseleave', handleMouseLeave);
    });
    return () => {
      wordElements.forEach(word => {
        if (word) {
          word.removeEventListener('mouseenter', handleMouseEnter);
          word.removeEventListener('mouseleave', handleMouseLeave);
        }
      });
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll('.floating-element-animate');
    floatingElementsRef.current = Array.from(elements);
    const handleScroll = () => {
      if (!scrolled) {
        setScrolled(true);
        floatingElementsRef.current.forEach((el, index) => {
          setTimeout(() => {
            if (el) {
              (el as HTMLElement).style.animationPlayState = 'running';
              (el as HTMLElement).style.opacity = ''; 
            }
          }, (parseFloat((el as HTMLElement).style.animationDelay || "0") * 1000) + index * 100);
        });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  return (
    <>
      <style>{`
        #mouse-gradient-react {
          position: fixed;
          pointer-events: none;
          border-radius: 9999px;
          background-image: radial-gradient(circle, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.05), transparent 70%);
          transform: translate(-50%, -50%);
          will-change: left, top, opacity;
          transition: left 70ms linear, top 70ms linear, opacity 300ms ease-out;
          z-index: 1;
        }
        @keyframes word-appear { 
          0% { opacity: 0; transform: translateY(30px) scale(0.8); filter: blur(10px); } 
          50% { opacity: 0.8; transform: translateY(10px) scale(0.95); filter: blur(2px); } 
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } 
        }
        @keyframes grid-draw { 
          0% { stroke-dashoffset: 1000; opacity: 0; } 
          50% { opacity: 0.3; } 
          100% { stroke-dashoffset: 0; opacity: 0.15; } 
        }
        @keyframes pulse-glow { 
          0%, 100% { opacity: 0.1; transform: scale(1); } 
          50% { opacity: 0.3; transform: scale(1.1); } 
        }
        .word-animate { 
          display: inline-block; 
          opacity: 0; 
          margin: 0 0.1em; 
          transition: color 0.3s ease, transform 0.3s ease; 
        }
        .word-animate:hover { 
          color: hsl(var(--primary)); 
          transform: translateY(-2px); 
        }
        .grid-line { 
          stroke: hsl(var(--primary) / 0.3); 
          stroke-width: 0.5; 
          opacity: 0; 
          stroke-dasharray: 5 5; 
          stroke-dashoffset: 1000; 
          animation: grid-draw 2s ease-out forwards; 
        }
        .detail-dot { 
          fill: hsl(var(--primary)); 
          opacity: 0; 
          animation: pulse-glow 3s ease-in-out infinite; 
        }
        .corner-element-animate { 
          position: absolute; 
          width: 40px; 
          height: 40px; 
          border: 1px solid hsl(var(--primary) / 0.2); 
          opacity: 0; 
          animation: word-appear 1s ease-out forwards; 
        }
        .text-decoration-animate { 
          position: relative; 
        }
        .text-decoration-animate::after { 
          content: ''; 
          position: absolute; 
          bottom: -4px; 
          left: 0; 
          width: 0; 
          height: 1px; 
          background: linear-gradient(90deg, transparent, hsl(var(--primary)), transparent); 
          animation: underline-grow 2s ease-out forwards; 
          animation-delay: 2s; 
        }
        @keyframes underline-grow { to { width: 100%; } }
        .floating-element-animate { 
          position: absolute; 
          width: 2px; 
          height: 2px; 
          background: hsl(var(--primary)); 
          border-radius: 50%; 
          opacity: 0; 
          animation: float 4s ease-in-out infinite; 
          animation-play-state: paused; 
        }
        @keyframes float { 
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; } 
          25% { transform: translateY(-10px) translateX(5px); opacity: 0.6; } 
          50% { transform: translateY(-5px) translateX(-3px); opacity: 0.4; } 
          75% { transform: translateY(-15px) translateX(7px); opacity: 0.8; } 
        }
        .ripple-effect { 
          position: fixed; 
          width: 8px; 
          height: 8px; 
          background: radial-gradient(circle, hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.4), transparent);
          border-radius: 50%; 
          transform: translate(-50%, -50%); 
          pointer-events: none; 
          animation: ripple-expand 1s ease-out forwards; 
          z-index: 9999; 
        }
        @keyframes ripple-expand {
          0% { width: 8px; height: 8px; opacity: 1; }
          100% { width: 100px; height: 100px; opacity: 0; }
        }
      `}</style>
      
      <div className={`relative overflow-hidden ${className}`}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <pattern id="gridReactDarkResponsive" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="hsl(var(--primary) / 0.05)" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridReactDarkResponsive)" />
          <line x1="0" y1="20%" x2="100%" y2="20%" className="grid-line" style={{ animationDelay: '0.5s' }} />
          <line x1="0" y1="80%" x2="100%" y2="80%" className="grid-line" style={{ animationDelay: '1s' }} />
          <line x1="20%" y1="0" x2="20%" y2="100%" className="grid-line" style={{ animationDelay: '1.5s' }} />
          <line x1="80%" y1="0" x2="80%" y2="100%" className="grid-line" style={{ animationDelay: '2s' }} />
          <line x1="50%" y1="0" x2="50%" y2="100%" className="grid-line" style={{ animationDelay: '2.5s', opacity: '0.05' }} />
          <line x1="0" y1="50%" x2="100%" y2="50%" className="grid-line" style={{ animationDelay: '3s', opacity: '0.05' }} />
          <circle cx="20%" cy="20%" r="2" className="detail-dot" style={{ animationDelay: '3s' }} />
          <circle cx="80%" cy="20%" r="2" className="detail-dot" style={{ animationDelay: '3.2s' }} />
          <circle cx="20%" cy="80%" r="2" className="detail-dot" style={{ animationDelay: '3.4s' }} />
          <circle cx="80%" cy="80%" r="2" className="detail-dot" style={{ animationDelay: '3.6s' }} />
          <circle cx="50%" cy="50%" r="1.5" className="detail-dot" style={{ animationDelay: '4s' }} />
        </svg>

        <div className="corner-element-animate top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8 z-10" style={{ animationDelay: '4s' }}>
          <div className="absolute top-0 left-0 w-2 h-2 bg-primary opacity-30 rounded-full"></div>
        </div>
        <div className="corner-element-animate top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 z-10" style={{ animationDelay: '4.2s' }}>
          <div className="absolute top-0 right-0 w-2 h-2 bg-primary opacity-30 rounded-full"></div>
        </div>
        <div className="corner-element-animate bottom-4 left-4 sm:bottom-6 sm:left-6 md:bottom-8 md:left-8 z-10" style={{ animationDelay: '4.4s' }}>
          <div className="absolute bottom-0 left-0 w-2 h-2 bg-primary opacity-30 rounded-full"></div>
        </div>
        <div className="corner-element-animate bottom-4 right-4 sm:bottom-6 sm:right-6 md:bottom-8 md:right-8 z-10" style={{ animationDelay: '4.6s' }}>
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-primary opacity-30 rounded-full"></div>
        </div>

        <div className="floating-element-animate z-10" style={{ top: '25%', left: '15%', animationDelay: '0.5s' }}></div>
        <div className="floating-element-animate z-10" style={{ top: '60%', left: '85%', animationDelay: '1s' }}></div>
        <div className="floating-element-animate z-10" style={{ top: '40%', left: '10%', animationDelay: '1.5s' }}></div>
        <div className="floating-element-animate z-10" style={{ top: '75%', left: '90%', animationDelay: '2s' }}></div>
        <div className="floating-element-animate z-10" style={{ top: '15%', left: '70%', animationDelay: '2.5s' }}></div>
        <div className="floating-element-animate z-10" style={{ top: '85%', left: '30%', animationDelay: '3s' }}></div>

        <div className="relative z-20">
          {children}
        </div>

        <div 
          id="mouse-gradient-react"
          className="w-60 h-60 blur-xl sm:w-80 sm:h-80 sm:blur-2xl md:w-96 md:h-96 md:blur-3xl"
          style={{
            left: mouseGradientStyle.left,
            top: mouseGradientStyle.top,
            opacity: mouseGradientStyle.opacity,
          }}
        ></div>

        {ripples.map(ripple => (
          <div
            key={ripple.id}
            className="ripple-effect"
            style={{ left: `${ripple.x}px`, top: `${ripple.y}px` }}
          ></div>
        ))}
      </div>
    </>
  );
}
