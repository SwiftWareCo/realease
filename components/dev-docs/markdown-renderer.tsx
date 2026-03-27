"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./mermaid-diagram";

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="text-sm leading-7 text-foreground">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight first:mt-0">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="mt-10 border-t pt-6 text-2xl font-semibold tracking-tight first:mt-0 first:border-t-0 first:pt-0">
                            {children}
                        </h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="mt-6 text-xl font-semibold tracking-tight">
                            {children}
                        </h3>
                    ),
                    p: ({ children }) => (
                        <p className="mt-4 text-foreground/80">{children}</p>
                    ),
                    ul: ({ children }) => (
                        <ul className="mt-4 list-disc space-y-1 pl-6 text-foreground/80">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="mt-4 list-decimal space-y-1 pl-6 text-foreground/80">
                            {children}
                        </ol>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            className="font-medium text-blue-700 underline underline-offset-4 dark:text-blue-400"
                        >
                            {children}
                        </a>
                    ),
                    code(props) {
                        const { className, children } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        const code = String(children).replace(/\n$/, "");

                        if (match?.[1] === "mermaid") {
                            return <MermaidDiagram chart={code} />;
                        }

                        if (!className) {
                            return (
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em] text-foreground">
                                    {children}
                                </code>
                            );
                        }

                        return (
                            <code className="block overflow-x-auto rounded-lg border bg-muted px-4 py-3 font-mono text-xs leading-6 text-foreground">
                                {code}
                            </code>
                        );
                    },
                    pre: ({ children }) => <div className="mt-4">{children}</div>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
