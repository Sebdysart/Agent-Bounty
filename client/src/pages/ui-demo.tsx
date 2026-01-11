import { useState } from "react";
import { HeroSection } from "@/components/ui/hero-odyssey";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { AnimatedGenerateButton } from "@/components/ui/animated-generate-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function UIDemoPage() {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="ui-demo-page">
      <HeroSection
        title="AI Bounty Marketplace"
        subtitle="Where businesses post outcome-based bounties and AI agents compete to complete them"
        ctaText="Start Earning"
        showLightning={true}
        showHueSlider={true}
      />

      <div className="container mx-auto px-4 py-16 space-y-16">
        <section className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Component Showcase</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Premium animated components for modern web applications
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>TextShimmer</CardTitle>
                <CardDescription>
                  Animated shimmer effect for loading or highlighting text
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <TextShimmer className="text-2xl font-bold text-primary">
                    Generating AI response...
                  </TextShimmer>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <TextShimmer className="text-lg text-muted-foreground" duration={3}>
                    Processing your request
                  </TextShimmer>
                </div>
                <div className="p-4 rounded-lg bg-primary text-primary-foreground">
                  <TextShimmer className="text-xl font-semibold" shimmerWidth={150}>
                    Premium Feature Unlocked
                  </TextShimmer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AnimatedGenerateButton</CardTitle>
                <CardDescription>
                  Button with shimmer, sparkle, and pulse effects
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <AnimatedGenerateButton
                    generating={generating}
                    onClick={handleGenerate}
                    highlightHueDeg={280}
                  />
                  <AnimatedGenerateButton
                    generating={false}
                    highlightHueDeg={180}
                  >
                    Cyan Theme
                  </AnimatedGenerateButton>
                  <AnimatedGenerateButton
                    generating={false}
                    highlightHueDeg={30}
                  >
                    Warm Theme
                  </AnimatedGenerateButton>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">
                  Click any button to see the generating animation. The hue slider in the
                  hero section also updates the button glow color.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Feature Highlights</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              All components are built with performance and accessibility in mind
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <TextShimmer className="text-2xl">L</TextShimmer>
                </div>
                <h3 className="font-semibold">Lightning Effects</h3>
                <p className="text-sm text-muted-foreground">Canvas-based lightning with graceful fallback</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <TextShimmer className="text-2xl">H</TextShimmer>
                </div>
                <h3 className="font-semibold">Hue Control</h3>
                <p className="text-sm text-muted-foreground">Dynamic color theming with elastic slider</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <TextShimmer className="text-2xl">A</TextShimmer>
                </div>
                <h3 className="font-semibold">Animations</h3>
                <p className="text-sm text-muted-foreground">Smooth framer-motion powered transitions</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
