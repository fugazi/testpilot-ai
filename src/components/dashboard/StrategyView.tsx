'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Sparkles,
  Target,
  ListChecks,
  LogIn,
  ShoppingCart,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import { cn } from '@/lib/utils';
import { HeaderBar } from './HeaderBar';

interface StrategyViewProps {
  domainUrl?: string;
  pagesProcessed?: number;
  flowsIdentified?: number;
  coveragePercentage?: number;
  coverageByFlow?: Array<{ name: string; percentage: number }>;
  summary?: string;
  /** Optional download handler for the header Download ZIP action */
  onDownload?: () => Promise<void> | void;
  className?: string;
} 

const defaultCoverageByFlow = [
  { name: 'Home', percentage: 100 },
  { name: 'Login', percentage: 92 },
  { name: 'Checkout', percentage: 64 },
];

const prioritizedTestCases = [
  { name: 'Secure Login', priority: 'critical', icon: LogIn },
  { name: 'Checkout Flow', priority: 'critical', icon: ShoppingCart },
  { name: 'User Profile', priority: 'medium', icon: User },
];

export function StrategyView({
  domainUrl = 'dashboard.testpilot.ai',
  pagesProcessed = 14,
  flowsIdentified = 5,
  coveragePercentage = 84,
  coverageByFlow = defaultCoverageByFlow,
  // summary prop available for future use if needed
  onDownload,
  className,
}: StrategyViewProps) {
  return (
    <div className={cn('space-y-8 md:space-y-10', className)}>
      {/* Header Bar */}
      <HeaderBar
        domainUrl={domainUrl}
        pagesProcessed={pagesProcessed}
        flowsIdentified={flowsIdentified}
        onDownload={onDownload}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Strategy Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* High-Level Overview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                High-Level Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our AI has analyzed your application at <strong className="text-foreground">{domainUrl}</strong>. 
                We&apos;ve prioritized a behavioral testing approach that focuses on 
                end-to-end reliability for your most critical business flows.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The strategy focuses on <span className="text-primary font-medium">{coveragePercentage}% core path coverage</span> across 
                different viewports, ensuring that whether your users are on desktop or 
                mobile, the experience remains seamless.
              </p>
            </CardContent>
          </Card>

          {/* Testing Objectives */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Testing Objectives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                To ensure your app stays delightful, we&apos;ve set these friendly goals:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  'Zero regression on the checkout flow to keep revenue flowing smoothly.',
                  'Verify lightning-fast login speeds for a great first impression.',
                  'Maintain perfect responsive layouts across all mobile devices.',
                  'Ensure data integrity during heavy user profile updates.',
                ].map((objective, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{objective}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Testing Goals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" />
                Testing Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our primary objective is to achieve a <strong className="text-foreground">99.9% stability target</strong> for all 
                critical business logic. We aim for <strong className="text-foreground">{coveragePercentage}% overall code coverage</strong> with 
                an execution time window of <strong className="text-foreground">under 3 minutes</strong> per test suite run.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By leveraging Playwright&apos;s parallel execution, we minimize 
                feedback loops for developers while maintaining high-fidelity 
                browser validation.
              </p>
            </CardContent>
          </Card>

          {/* Prioritized Test Cases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" />
                Prioritized Test Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {prioritizedTestCases.map((testCase) => (
                  <div
                    key={testCase.name}
                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 min-w-25"
                  >
                    <div className="relative">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <testCase.icon className="h-6 w-6" />
                      </div>
                      <Badge
                        variant={testCase.priority === 'critical' ? 'destructive' : 'secondary'}
                        className="absolute -top-2 -right-2 text-[10px] px-1.5"
                      >
                        {testCase.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {testCase.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Coverage Map */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Coverage Map
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <ProgressRing value={coveragePercentage} size={140} strokeWidth={12} />
              
              <div className="w-full space-y-3">
                {coverageByFlow.map((flow) => (
                  <div key={flow.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{flow.name}</span>
                      <span className="text-muted-foreground">{flow.percentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${flow.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
