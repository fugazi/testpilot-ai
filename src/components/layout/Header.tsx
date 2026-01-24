'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/providers/ToastProvider';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [isDark, setIsDark] = React.useState(false);
  const toast = useToast();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60',
        className
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-primary-foreground"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            TestPilot <span className="text-primary">AI</span>
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm px-3 py-2"
            aria-label="New project"
            onClick={() => {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.clear();
                  sessionStorage.clear();
                }
                toast.toast({
                  id: `newproj-${Date.now()}`,
                  title: 'New Project',
                  message: 'Starting a new blank project.'
                });
              } catch (e) {
                console.error('Error clearing storage for new project', e);
              }
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Project</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
