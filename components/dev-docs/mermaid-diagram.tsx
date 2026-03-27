"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";

interface MermaidDiagramProps {
    chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const reactId = useId();
    const [svg, setSvg] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        let cancelled = false;

        async function renderDiagram() {
            try {
                const mermaid = (await import("mermaid")).default;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: "loose",
                    theme: resolvedTheme === "dark" ? "dark" : "neutral",
                });

                const diagramId = `mermaid-${reactId.replace(/[:]/g, "-")}`;
                const { svg: renderedSvg } = await mermaid.render(diagramId, chart);

                if (!cancelled) {
                    setSvg(renderedSvg);
                    setError(null);
                }
            } catch (renderError) {
                if (!cancelled) {
                    setSvg("");
                    setError(
                        renderError instanceof Error
                            ? renderError.message
                            : "Unable to render Mermaid diagram.",
                    );
                }
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [chart, reactId, resolvedTheme]);

    if (error) {
        return (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
                <p className="font-semibold">Mermaid render failed</p>
                <p className="mt-2 whitespace-pre-wrap break-words">{error}</p>
            </div>
        );
    }

    if (!svg) {
        return (
            <div className="mt-4 rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
                Rendering diagram...
            </div>
        );
    }

    return (
        <div className="mt-4 overflow-x-auto rounded-lg border bg-background p-4">
            <div
                className="min-w-max [&_svg]:h-auto [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
            />
        </div>
    );
}
