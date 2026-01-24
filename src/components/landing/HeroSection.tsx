'use client';

import React from 'react';
import { Sparkles, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}

export function HeroSection({
  url,
  setUrl,
  isLoading,
  onSubmit,
  className,
}: HeroSectionProps) {
  return (
    <section
      className={cn(
        'relative w-full py-16 md:py-24 lg:py-32',
        className
      )}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-125 bg-linear-to-b from-primary/5 via-primary/3 to-transparent" />
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Sparkles className="h-4 w-4" />
            <span className="uppercase tracking-wider text-xs">
              Powered by GitHub Copilot SDK
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Generate automated tests
            </h1>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary">
              for any web application
            </h2>
          </div>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            Enter a URL. Our AI will explore the site, detect critical flows, 
            and generate a professional <strong className="text-foreground">Playwright</strong> test suite.
          </p>

          {/* URL Input Form */}
          <form
            onSubmit={onSubmit}
            className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300"
          >
            <div className="relative flex items-center">
              <div className="absolute left-5 text-muted-foreground">
                <LinkIcon className="h-5 w-5" />
              </div>
              <Input
                type="url"
                placeholder="https://dashboard.testpilot.ai"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                required
                className="h-16 pl-14 pr-44 text-base md:text-lg rounded-full border-2 border-border bg-card shadow-lg focus-visible:ring-primary focus-visible:border-primary"
              />
              <div className="absolute right-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="lg"
                  className="h-12 px-6 md:px-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-all hover:shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="hidden sm:inline">Processing</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Generate Tests</span>
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
