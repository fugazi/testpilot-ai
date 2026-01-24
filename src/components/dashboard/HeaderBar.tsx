'use client';

import React from 'react';
import { CheckCircle2, Download, Share2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderBarProps {
  domainUrl?: string;
  pagesProcessed?: number;
  flowsIdentified?: number;
  onDownload?: () => Promise<void> | void;
  className?: string;
}

/**
 * Reusable header bar used across strategy and code views.
 */
export function HeaderBar({
  domainUrl = 'dashboard.testpilot.ai',
  pagesProcessed = 0,
  flowsIdentified = 0,
  onDownload,
  className,
}: HeaderBarProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border', className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Analysis Completed</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-foreground">{domainUrl}</span>
          <span className="text-xs text-muted-foreground">Processed {pagesProcessed} pages and identified {flowsIdentified} critical user flows.</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => onDownload && onDownload()}>
          <Download className="h-4 w-4" />
          Download ZIP
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
