"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileJson,
  FileCode2,
  FileText,
  Settings,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/providers/ToastProvider";

/**
 * Code file representation used by the viewer.
 */
export interface CodeFile {
  filename: string;
  language: string;
  content: string;
}

/**
 * Node type for the file explorer tree.
 */
interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  file?: CodeFile;
}

/** Props for the CodeViewer component */
interface CodeViewerProps {
  files: CodeFile[];
  className?: string;
}

// Custom Dracula-inspired theme with better colors
const draculaCustom = {
  ...dracula,
  'pre[class*="language-"]': {
    ...dracula['pre[class*="language-"]'],
    background: "#1e1f29",
    fontFamily:
      "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace",
    fontSize: "13px",
    lineHeight: "1.6",
  },
  'code[class*="language-"]': {
    ...dracula['code[class*="language-"]'],
    background: "#1e1f29",
    fontFamily:
      "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace",
    fontSize: "13px",
    lineHeight: "1.6",
  },
};

// Build file tree from flat file list
function buildFileTree(files: CodeFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  files.forEach((file) => {
    const parts = file.filename.split("/");
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const existingNode = currentLevel.find((n) => n.name === part);

      if (existingNode) {
        if (!isFile && existingNode.children) {
          currentLevel = existingNode.children;
        }
      } else {
        const newNode: FileTreeNode = {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
          file: isFile ? file : undefined,
        };
        currentLevel.push(newNode);
        if (!isFile && newNode.children) {
          currentLevel = newNode.children;
        }
      }
    });
  });

  // Sort: folders first, then files alphabetically
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));
  };

  return sortNodes(root);
}

/**
 * Choose an icon component based on file name/extension.
 * @param filename - File name or path
 */
function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const name = filename.toLowerCase();

  if (name === "package.json")
    return <FileJson className="w-4 h-4 text-green-400" />;
  if (name.includes("config")) return <Settings className="w-4 h-4 text-gray-400" />;
  if (ext === "json") return <FileJson className="w-4 h-4 text-yellow-400" />;
  if (ext === "ts" || ext === "tsx") return <FileCode2 className="w-4 h-4 text-blue-400" />;
  if (ext === "js" || ext === "jsx") return <FileCode2 className="w-4 h-4 text-yellow-300" />;
  if (name.includes("spec") || name.includes("test")) return <FileCode2 className="w-4 h-4 text-green-400" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}

// File Tree Item Component
function FileTreeItem({
  node,
  depth = 0,
  activeFile,
  onSelectFile,
  expandedFolders,
  onToggleFolder,
}: {
  node: FileTreeNode;
  depth?: number;
  activeFile: string;
  onSelectFile: (filename: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = node.type === "file" && node.path === activeFile;

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === "folder") {
            onToggleFolder(node.path);
          } else if (node.file) {
            onSelectFile(node.path);
          }
        }}
        className={cn(
          "w-full text-left py-1.5 px-2 rounded flex items-center gap-2 text-sm transition-colors",
          "hover:bg-white/5",
          isActive && "bg-primary/20 text-primary font-medium",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === "folder" ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-primary shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" /> {/* Spacer for alignment */}
            {getFileIcon(node.name)}
          </>
        )}
        <span className={cn("truncate", node.type === "folder" && "font-medium")}>
          {node.name}
        </span>
      </button>

      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Visual code viewer with a project explorer and syntax highlighting.
 * @param files - Files to display
 * @param className - Optional wrapper class
 */
export function CodeViewer({ files, className }: CodeViewerProps) {
  const [activeFile, setActiveFile] = useState(
    files && files.length ? files[0].filename : "",
  );
  const [isCopied, setIsCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Expand all folders by default
    const folders = new Set<string>();
    files.forEach((file) => {
      const parts = file.filename.split("/");
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join("/"));
      }
    });
    return folders;
  });

  const toast = useToast();

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  if (!files || files.length === 0) return null;

  const current = files.find((f) => f.filename === activeFile) || files[0];

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.toast({
      id: `copy-${Date.now()}`,
      title: "Copied",
      message: "File copied to clipboard.",
    });
    setTimeout(() => setIsCopied(false), 1500);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className={cn("w-full", className)}>
      <Card className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <div className="flex min-h-125">
          {/* Project Explorer Sidebar */}
          <aside className="w-64 bg-muted/30 border-r border-border flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Project Explorer
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {fileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  activeFile={activeFile}
                  onSelectFile={setActiveFile}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                />
              ))}
            </div>
          </aside>

          {/* Code Panel */}
          <div className="flex-1 flex flex-col bg-[#1e1f29]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#282a36] border-b border-[#44475a]">
              <div className="flex items-center gap-3">
                {getFileIcon(current.filename)}
                <span className="text-sm font-medium text-gray-200">
                  {current.filename.split("/").pop()}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {current.language}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(current.content)}
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullScreen(true)}
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto">
              <SyntaxHighlighter
                language={current.language}
                style={draculaCustom}
                showLineNumbers={true}
                lineNumberStyle={{
                  minWidth: "3em",
                  paddingRight: "1em",
                  color: "#6272a4",
                  textAlign: "right",
                  userSelect: "none",
                }}
                customStyle={{
                  margin: 0,
                  padding: "16px",
                  background: "#1e1f29",
                  minHeight: "100%",
                }}
                codeTagProps={{
                  style: {
                    fontFamily:
                      "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace",
                  },
                }}
              >
                {current.content.trim()}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      </Card>

      {/* Fullscreen modal */}
      {fullScreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-7xl h-[90vh] bg-[#1e1f29] rounded-lg overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#282a36] border-b border-[#44475a]">
              <div className="flex items-center gap-3">
                {getFileIcon(current.filename)}
                <span className="font-medium text-gray-200">
                  {current.filename}
                </span>
                <span className="text-xs text-gray-500 font-mono px-2 py-0.5 bg-[#44475a] rounded">
                  {current.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(current.content)}
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullScreen(false)}
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Code */}
            <div className="flex-1 overflow-auto">
              <SyntaxHighlighter
                language={current.language}
                style={draculaCustom}
                showLineNumbers={true}
                lineNumberStyle={{
                  minWidth: "3.5em",
                  paddingRight: "1.5em",
                  color: "#6272a4",
                  textAlign: "right",
                  userSelect: "none",
                }}
                customStyle={{
                  margin: 0,
                  padding: "24px",
                  background: "#1e1f29",
                  minHeight: "100%",
                  fontSize: "14px",
                }}
              >
                {current.content.trim()}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
