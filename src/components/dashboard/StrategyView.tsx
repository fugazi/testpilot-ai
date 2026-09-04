'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Target,
  ListChecks,
  FileCode2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressRing } from './ProgressRing';
import { cn } from '@/lib/utils';
import { HeaderBar } from './HeaderBar';
import type { CodeFile } from '@/lib/mdParser';
import type { ValidationResult } from '@/lib/validator';

interface StrategyViewProps {
  domainUrl?: string;
  /** Internal pages discovered by the crawler */
  pagesDiscovered?: number;
  /** All generated files (POMs, specs, config) */
  files?: CodeFile[];
  /** TypeScript validation results per file */
  validation?: ValidationResult[];
  /** Markdown summary produced by the agent */
  summary?: string;
  /** Optional download handler for the header Download ZIP action */
  onDownload?: () => Promise<void> | void;
  className?: string;
}

/** Markdown styling without the typography plugin: a few targeted selectors. */
const markdownStyles = {
  className: 'text-sm text-muted-foreground leading-relaxed space-y-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-medium [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto [&_table]:w-full [&_th]:text-left [&_th]:font-medium [&_td]:py-1',
};

export function StrategyView({
  domainUrl = '—',
  pagesDiscovered = 0,
  files = [],
  validation = [],
  summary = '',
  onDownload,
  className,
}: StrategyViewProps) {
  const validatedFiles = validation.length;
  const validFiles = validation.filter(v => v.errors.length === 0).length;
  const validationRate = validatedFiles > 0 ? Math.round((validFiles / validatedFiles) * 100) : 0;
  const specFiles = files.filter(f => /\.spec\.[jt]s$|\.test\.[jt]s$/.test(f.filename));

  return (
    <div className={cn('space-y-8 md:space-y-10', className)}>
      {/* Header Bar */}
      <HeaderBar
        domainUrl={domainUrl}
        pagesDiscovered={pagesDiscovered}
        filesGenerated={files.length}
        onDownload={onDownload}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Analysis from the agent */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analysis Summary (agent-generated markdown) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div {...markdownStyles}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summary}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  The agent did not return a written summary for this site.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Generated Test Specs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-primary" />
                Generated Test Specs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {specFiles.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {specFiles.map((file) => {
                    const result = validation.find(v => v.filename === file.filename);
                    const hasErrors = !!result && result.errors.length > 0;
                    return (
                      <div
                        key={file.filename}
                        className="flex flex-col items-center gap-2 p-4 rounded-lg bg-muted/50 min-w-25"
                      >
                        <div className="relative">
                          <div className={cn(
                            'h-12 w-12 rounded-xl flex items-center justify-center',
                            hasErrors ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                          )}>
                            <FileCode2 className="h-6 w-6" />
                          </div>
                          <Badge
                            variant={hasErrors ? 'destructive' : 'secondary'}
                            className="absolute -top-2 -right-2 text-[10px] px-1.5"
                          >
                            {hasErrors ? 'FIX' : 'OK'}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium text-foreground break-all text-center">
                          {file.filename}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No spec files were detected in the generated suite.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Validation */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Validation
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              {validatedFiles > 0 ? (
                <>
                  <ProgressRing value={validationRate} size={140} strokeWidth={12} />
                  <p className="text-xs text-muted-foreground -mt-3">
                    {validFiles} of {validatedFiles} TypeScript files pass validation
                  </p>
                  <div className="w-full space-y-2">
                    {validation.map((result) => (
                      <div
                        key={result.filename}
                        className="flex items-start gap-2 text-sm"
                        title={result.errors.join('\n')}
                      >
                        {result.errors.length === 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <span className="text-foreground font-medium truncate">
                          {result.filename}
                        </span>
                        {result.errors.length > 0 && (
                          <span className="text-muted-foreground ml-auto shrink-0">
                            {result.errors.length}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No TypeScript files to validate.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
