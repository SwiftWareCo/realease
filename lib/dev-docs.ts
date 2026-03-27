import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

const DOCS_DIR = path.join(process.cwd(), "docs", "architecture");

export interface DevDocSection {
    slug: string;
    title: string;
    content: string;
}

export interface DevDocFile {
    slug: string;
    title: string;
    filename: string;
    content: string;
    sections: DevDocSection[];
}

function formatTitle(value: string): string {
    return value
        .replace(/\.md$/i, "")
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function toSectionSlug(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "section"
    );
}

function splitMarkdownIntoSections(markdown: string): DevDocSection[] {
    const lines = markdown.split(/\r?\n/);
    const sections: DevDocSection[] = [];
    let currentTitle = "Overview";
    let currentLines: string[] = [];
    let sawSectionHeading = false;

    for (const line of lines) {
        if (/^##\s+/.test(line)) {
            const raw = currentLines.join("\n").trim();
            // For the overview block (before first ##), strip the leading h1 heading.
            // If nothing substantive remains, skip creating an empty overview section.
            const content =
                !sawSectionHeading
                    ? raw.replace(/^#\s+.*$/m, "").trim()
                    : raw;
            if (content) {
                sections.push({
                    slug: toSectionSlug(currentTitle),
                    title: currentTitle,
                    content,
                });
            }

            currentTitle = line.replace(/^##\s+/, "").trim();
            currentLines = [line];
            sawSectionHeading = true;
            continue;
        }

        currentLines.push(line);
    }

    if (currentLines.join("\n").trim()) {
        sections.push({
            slug: toSectionSlug(currentTitle),
            title: currentTitle,
            content: currentLines.join("\n").trim(),
        });
    }

    if (!sawSectionHeading) {
        return [
            {
                slug: "overview",
                title: "Overview",
                content: markdown.trim(),
            },
        ];
    }

    return sections;
}

export async function listArchitectureDocs(): Promise<DevDocFile[]> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
        entries = await fs.readdir(DOCS_DIR, { withFileTypes: true });
    } catch {
        return [];
    }

    const docs = await Promise.all(
        entries
            .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
            .map(async (entry) => {
                const content = await fs.readFile(
                    path.join(DOCS_DIR, entry.name),
                    "utf8",
                );

                return {
                    filename: entry.name,
                    slug: entry.name.replace(/\.md$/i, ""),
                    title: formatTitle(entry.name),
                    content,
                    sections: splitMarkdownIntoSections(content),
                } satisfies DevDocFile;
            }),
    );

    return docs.sort((a, b) => a.title.localeCompare(b.title));
}
