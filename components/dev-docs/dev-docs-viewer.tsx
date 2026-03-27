"use client";

import { useMemo, useState } from "react";
import type { DevDocFile } from "@/lib/dev-docs";
import { MarkdownRenderer } from "./markdown-renderer";

interface DevDocsViewerProps {
    docs: DevDocFile[];
}

export function DevDocsViewer({ docs }: DevDocsViewerProps) {
    const [activeDocSlug, setActiveDocSlug] = useState(docs[0]?.slug ?? "");
    const activeDoc = useMemo(
        () => docs.find((doc) => doc.slug === activeDocSlug) ?? docs[0],
        [activeDocSlug, docs],
    );
    const [activeSectionSlug, setActiveSectionSlug] = useState(
        activeDoc?.sections[0]?.slug ?? "",
    );

    if (docs.length === 0) {
        return (
            <div className="p-6">
                <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                    No markdown files found in <code>docs/architecture</code>.
                </div>
            </div>
        );
    }

    const sections = activeDoc?.sections ?? [];
    const activeSection =
        sections.find((section) => section.slug === activeSectionSlug) ??
        sections[0];

    return (
        <div className="space-y-4 p-4 md:p-6">
            <div className="rounded-xl border bg-card p-4">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Developer Docs
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Architecture docs from <code>docs/architecture</code> with
                    Mermaid rendering.
                </p>
            </div>

            <div className="rounded-xl border bg-card p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Documents
                </p>
                <div className="flex flex-wrap gap-2">
                    {docs.map((doc) => (
                        <button
                            key={doc.slug}
                            type="button"
                            onClick={() => {
                                setActiveDocSlug(doc.slug);
                                setActiveSectionSlug(
                                    doc.sections[0]?.slug ?? "",
                                );
                            }}
                            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                                doc.slug === activeDoc?.slug
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "hover:bg-muted"
                            }`}
                        >
                            {doc.title}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="rounded-xl border bg-card p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Sections
                    </p>
                    <div className="space-y-2">
                        {sections.map((section) => (
                            <button
                                key={section.slug}
                                type="button"
                                onClick={() =>
                                    setActiveSectionSlug(section.slug)
                                }
                                className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                    section.slug === activeSection?.slug
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "hover:bg-muted"
                                }`}
                            >
                                {section.title}
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="rounded-xl border bg-card p-4 md:p-6">
                    {activeDoc && activeSection ? (
                        <>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {activeDoc.title}
                            </p>
                            <h2 className="text-xl font-semibold tracking-tight">
                                {activeSection.title}
                            </h2>
                            <div className="mt-4">
                                <MarkdownRenderer
                                    content={activeSection.content}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Select a document section.
                        </p>
                    )}
                </main>
            </div>
        </div>
    );
}
