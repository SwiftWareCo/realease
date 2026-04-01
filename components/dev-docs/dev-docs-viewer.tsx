"use client";

import { useMemo, useState } from "react";
import type { DevDocFile } from "@/lib/dev-docs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

interface DevDocsViewerProps {
    docs: DevDocFile[];
}

interface StructuredSectionContent {
    intro: string;
    relevantFiles: string;
    userFlow: string;
    stepFunctionMap: string;
    technicalSequence: string;
    additional: string;
}

interface H3Block {
    title: string;
    content: string;
}

function normalizeHeading(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseH3Blocks(markdown: string): H3Block[] {
    const lines = markdown.split(/\r?\n/);
    const blocks: H3Block[] = [];
    let currentTitle: string | null = null;
    let currentLines: string[] = [];

    for (const line of lines) {
        if (/^###\s+/.test(line)) {
            if (currentTitle) {
                blocks.push({
                    title: currentTitle,
                    content:
                        `### ${currentTitle}\n${currentLines.join("\n")}`.trim(),
                });
            }
            currentTitle = line.replace(/^###\s+/, "").trim();
            currentLines = [];
            continue;
        }

        if (currentTitle) {
            currentLines.push(line);
        }
    }

    if (currentTitle) {
        blocks.push({
            title: currentTitle,
            content: `### ${currentTitle}\n${currentLines.join("\n")}`.trim(),
        });
    }

    return blocks;
}

function parseStructuredSection(
    markdown: string,
): StructuredSectionContent | null {
    const withoutH2 = markdown.replace(/^##\s+.*$/m, "").trim();
    const blocks = parseH3Blocks(withoutH2);
    if (blocks.length === 0) {
        return null;
    }

    const intro = withoutH2.split(/^###\s+/m)[0]?.trim() ?? "";
    const relevantFiles = blocks.find(
        (block) => normalizeHeading(block.title) === "relevant files",
    );
    const userFlow = blocks.find(
        (block) => normalizeHeading(block.title) === "user flow",
    );
    const stepFunctionMap =
        blocks.find(
            (block) => normalizeHeading(block.title) === "step function map",
        ) ??
        blocks.find(
            (block) => normalizeHeading(block.title) === "function map",
        );
    const technicalSequence = blocks.find(
        (block) => normalizeHeading(block.title) === "technical sequence",
    );

    if (!relevantFiles || !userFlow || !technicalSequence) {
        return null;
    }

    const additional = blocks
        .filter((block) => {
            const heading = normalizeHeading(block.title);
            return (
                heading !== "relevant files" &&
                heading !== "user flow" &&
                heading !== "step function map" &&
                heading !== "function map" &&
                heading !== "technical sequence"
            );
        })
        .map((block) => block.content)
        .join("\n\n")
        .trim();

    return {
        intro,
        relevantFiles: relevantFiles.content,
        userFlow: userFlow.content,
        stepFunctionMap: stepFunctionMap?.content ?? "",
        technicalSequence: technicalSequence.content,
        additional,
    };
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

    const sections = activeDoc?.sections ?? [];
    const activeSection =
        sections.find((section) => section.slug === activeSectionSlug) ??
        sections[0];
    const structuredSection = useMemo(
        () =>
            activeSection
                ? parseStructuredSection(activeSection.content)
                : null,
        [activeSection],
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
                                {structuredSection ? (
                                    <div className="space-y-6">
                                        {structuredSection.intro ? (
                                            <MarkdownRenderer
                                                content={
                                                    structuredSection.intro
                                                }
                                            />
                                        ) : null}

                                        <MarkdownRenderer
                                            content={
                                                structuredSection.relevantFiles
                                            }
                                        />

                                        <Tabs
                                            key={`${activeDoc?.slug ?? "doc"}-${activeSection?.slug ?? "section"}`}
                                            defaultValue="user-flow"
                                            className="gap-4"
                                        >
                                            <TabsList>
                                                <TabsTrigger value="user-flow">
                                                    User Flow
                                                </TabsTrigger>
                                                <TabsTrigger value="technical-sequence">
                                                    Technical Sequence
                                                </TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="user-flow">
                                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                                                    <div className="min-w-0 rounded-lg border bg-background/60 p-3">
                                                        <MarkdownRenderer
                                                            content={
                                                                structuredSection.userFlow
                                                            }
                                                        />
                                                    </div>

                                                    {structuredSection.stepFunctionMap ? (
                                                        <>
                                                            <div className="hidden xl:block">
                                                                <div className="sticky top-4 rounded-lg border bg-muted/20 p-3">
                                                                    <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                        Step
                                                                        Function
                                                                        Map
                                                                    </p>
                                                                    <div className="mt-2">
                                                                        <MarkdownRenderer
                                                                            content={
                                                                                structuredSection.stepFunctionMap
                                                                            }
                                                                            compactInlineCode
                                                                            className="[&_table]:w-full [&_table]:table-fixed [&_th]:align-top [&_td]:align-top [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_td]:break-words"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="xl:hidden">
                                                                <Collapsible
                                                                    key={`${activeDoc?.slug ?? "doc"}-${activeSection?.slug ?? "section"}-step-map`}
                                                                    className="overflow-hidden rounded-lg border bg-muted/20"
                                                                >
                                                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                                                                        <span className="text-sm font-medium">
                                                                            Step
                                                                            Function
                                                                            Map
                                                                        </span>
                                                                        <ChevronDown className="size-4 text-muted-foreground" />
                                                                    </CollapsibleTrigger>
                                                                    <CollapsibleContent className="border-t px-4 pb-4 pt-3">
                                                                        <MarkdownRenderer
                                                                            content={
                                                                                structuredSection.stepFunctionMap
                                                                            }
                                                                            compactInlineCode
                                                                            className="[&_table]:w-full [&_table]:table-fixed [&_th]:align-top [&_td]:align-top [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_td]:break-words"
                                                                        />
                                                                    </CollapsibleContent>
                                                                </Collapsible>
                                                            </div>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="technical-sequence">
                                                <MarkdownRenderer
                                                    content={
                                                        structuredSection.technicalSequence
                                                    }
                                                />
                                            </TabsContent>
                                        </Tabs>

                                        {structuredSection.additional ? (
                                            <MarkdownRenderer
                                                content={
                                                    structuredSection.additional
                                                }
                                            />
                                        ) : null}
                                    </div>
                                ) : (
                                    <MarkdownRenderer
                                        content={activeSection.content}
                                    />
                                )}
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
