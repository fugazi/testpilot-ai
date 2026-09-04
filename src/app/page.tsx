'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, FileText, Code2 } from 'lucide-react';
import { useToast } from '@/components/providers/ToastProvider';
import { Header, Footer } from '@/components/layout';
import { HeroSection, FeaturesSection } from '@/components/landing';
import { Sidebar, StrategyView } from '@/components/dashboard';
import { HeaderBar } from '@/components/dashboard/HeaderBar';
import JSZip from 'jszip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeViewer, CodeFile } from '@/components/dashboard';
import type { ValidationResult } from '@/lib/validator';

/** Response structure returned by POST /api/agent */
interface AgentResponse {
  success: boolean;
  data: string;
  summary: string;
  files: CodeFile[];
  progress: string[];
  validation: ValidationResult[];
  context: {
    title?: string;
    description?: string;
    linksCount: number;
    formsCount: number;
    isDynamic: boolean;
  };
  stats: { generatedFilesCount: number };
}

/** What the dashboard needs to render results */
interface AgentResult {
  summary: string;
  files: CodeFile[];
  progress?: string[];
  validation?: ValidationResult[];
  context?: AgentResponse['context'];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const progressSteps = React.useMemo(() => [
    'Initializing TestPilot AI...',
    '🔍 Analyzing site structure...',
    '🍍 Identifying critical user flows and edge cases...',
    '⚙️ Generating test strategy and Playwright tests...',
    '📦 Building Page Object Models and test specs...',
    '✅ Analysis completed successfully.'
  ], []);

  const statusIndexRef = React.useRef(0);
  const intervalRef = React.useRef<number | null>(null);

  // Manage sequential status messages while loading
  React.useEffect(() => {
    if (!isLoading) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    statusIndexRef.current = 0;
    intervalRef.current = window.setInterval(() => {
      statusIndexRef.current = (statusIndexRef.current + 1) % progressSteps.length;
      setStatusMessage(progressSteps[statusIndexRef.current]);
    }, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isLoading, progressSteps]);

  const toast = useToast();

  const handleDownload = React.useCallback(async () => {
    if (!agentResult) return;
    try {
      const zip = new JSZip();
      agentResult.files.forEach((f) => zip.file(f.filename, f.content));
      zip.file('TEST_STRATEGY.md', agentResult.summary || '');

      if (!agentResult.files.some(f => f.filename === 'package.json')) {
        zip.file('package.json', JSON.stringify({
          name: 'autonomous-tests',
          version: '1.0.0',
          scripts: { test: 'playwright test' },
          devDependencies: { '@playwright/test': '^1.40.0', 'typescript': '^5.0.0' }
        }, null, 2));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const urlBlob = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = urlBlob;
      link.download = 'playwright-suite.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlBlob);

      toast.toast({ id: `zip-${Date.now()}`, title: 'Download ready', message: 'The ZIP package has been downloaded.' });
    } catch (e) {
      console.error(e);
      toast.toast({ id: `zip-err-${Date.now()}`, title: 'Download failed', variant: 'error', message: 'Could not create ZIP.' });
    }
  }, [agentResult, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setAgentResult(null);
    statusIndexRef.current = 0;
    setStatusMessage(progressSteps[statusIndexRef.current]);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        let message = `Analysis failed (HTTP ${response.status}).`;
        try {
          const errorData = await response.json();
          if (errorData?.error) message = errorData.error;
        } catch {
          // Respuesta no-JSON (p.ej. HTML de un proxy/gateway): usar el mensaje por defecto
        }
        throw new Error(message);
      }

      const data: AgentResponse = await response.json();

      setAgentResult({
        summary: data.summary || '',
        files: data.files || [],
        progress: data.progress || [],
        validation: data.validation || [],
        context: data.context,
      });
      toast.toast({
        id: `done-${Date.now()}`,
        title: 'Analysis complete',
        message: 'Test strategy and files generated.'
      });

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'An unexpected error occurred. Try with a simpler URL.');
      toast.toast({
        id: `err-${Date.now()}`,
        title: 'Error',
        variant: 'error',
        message: message || 'Unexpected error'
      });
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Extract domain from URL for display
  const getDomainFromUrl = (inputUrl: string) => {
    try {
      const urlObj = new URL(inputUrl);
      return urlObj.hostname;
    } catch {
      return inputUrl;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section - Always visible */}
        <HeroSection
          url={url}
          setUrl={setUrl}
          isLoading={isLoading}
          onSubmit={handleSubmit}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="container mx-auto px-4 md:px-6 -mt-8 mb-8">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-card border border-border shadow-md text-sm text-foreground animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {statusMessage}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="container mx-auto px-4 md:px-6 -mt-8 mb-8">
            <div className="max-w-2xl mx-auto p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* Features Section - Only show when no results */}
        {!agentResult && !isLoading && <FeaturesSection />}

        {/* Results Dashboard */}
        {agentResult && (
          <section className="container mx-auto px-4 md:px-6 pb-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex gap-6">
              {/* Sidebar */}
              <Sidebar
                filesCount={agentResult.files.length}
                className="hidden lg:block"
              />

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <Tabs defaultValue="strategy" className="w-full">
                  <TabsList className="mb-6 bg-muted/50">
                    <TabsTrigger value="strategy" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Test Strategy
                    </TabsTrigger>
                    <TabsTrigger value="code" className="gap-2">
                      <Code2 className="h-4 w-4" />
                      Code
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="strategy">
                    <StrategyView
                      domainUrl={getDomainFromUrl(url)}
                      pagesDiscovered={agentResult.context?.linksCount ?? 0}
                      files={agentResult.files}
                      validation={agentResult.validation ?? []}
                      summary={agentResult.summary}
                      onDownload={handleDownload}
                    />
                  </TabsContent>

                  <TabsContent value="code">
                    <HeaderBar
                      domainUrl={getDomainFromUrl(url)}
                      pagesDiscovered={agentResult.context?.linksCount ?? 0}
                      filesGenerated={agentResult.files.length}
                      onDownload={handleDownload}
                    />

                    <div className="mt-8 md:mt-10">
                      <CodeViewer files={agentResult.files} />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
