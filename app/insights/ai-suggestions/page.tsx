'use client';

import { Sparkles, BrainCircuit } from 'lucide-react';
import { SuggestionSourceWidget } from '../components/SuggestionSourceWidget';
import { InsightsSection } from '../components/InsightsSection';

export default function AISuggestionsPage() {
    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 p-4">
            <h1 className="shrink-0 text-lg font-bold tracking-tight">AI Suggestions</h1>

            {/* Scrollable grid area for suggestions, filling remaining space */}
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/20 p-4">
                <SuggestionSourceWidget />
            </div>
        </div>
    );
}
