'use client';

import React from 'react';
import { Zap, Shield, GitBranch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Instant Generation',
    description:
      'Convert user flows into robust Playwright or Cypress tests in seconds.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Self-healing Tests',
    description:
      'Our AI automatically updates test selectors when your UI changes.',
  },
  {
    icon: <GitBranch className="h-6 w-6" />,
    title: 'CI/CD Ready',
    description:
      'Seamlessly integrate with GitHub Actions, GitLab, and Jenkins.',
  },
];

interface FeaturesSectionProps {
  className?: string;
}

export function FeaturesSection({ className }: FeaturesSectionProps) {
  return (
    <section className={cn('w-full py-16 md:py-24', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className={cn(
                'group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg',
                'animate-in fade-in slide-in-from-bottom-4 duration-500',
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
