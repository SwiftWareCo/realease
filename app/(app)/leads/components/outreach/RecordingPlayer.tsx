"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatSeconds(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "0:00";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RecordingPlayer({ src }: { src: string }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isErrored, setIsErrored] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const handleLoadedMetadata = () => {
            setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
            setIsErrored(false);
        };
        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime || 0);
        };
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);
        const handleError = () => {
            setIsPlaying(false);
            setIsErrored(true);
        };

        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);

        return () => {
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
        };
    }, [src]);

    const progressValue = useMemo(() => {
        if (duration <= 0) {
            return 0;
        }
        return Math.min(currentTime, duration);
    }, [currentTime, duration]);

    const togglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio || isErrored) {
            return;
        }
        if (audio.paused) {
            try {
                await audio.play();
            } catch {
                setIsPlaying(false);
            }
            return;
        }
        audio.pause();
    };

    const handleSeek = (value: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(value)) {
            return;
        }
        audio.currentTime = value;
        setCurrentTime(value);
    };

    return (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recording
                </p>
                <Button variant="outline" size="sm" asChild>
                    <a href={src} download target="_blank" rel="noreferrer">
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                    </a>
                </Button>
            </div>

            {isErrored ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Could not load recording in the player.
                    <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-primary underline-offset-2 hover:underline"
                    >
                        Open recording
                    </a>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 shrink-0"
                        onClick={togglePlayback}
                        disabled={duration <= 0}
                    >
                        {isPlaying ? (
                            <Pause className="h-4 w-4" />
                        ) : (
                            <Play className="h-4 w-4" />
                        )}
                    </Button>
                    <div className="min-w-0 flex-1 space-y-1">
                        <input
                            type="range"
                            min={0}
                            max={duration > 0 ? duration : 0}
                            step={0.1}
                            value={progressValue}
                            onChange={(event) =>
                                handleSeek(Number(event.target.value))
                            }
                            className="h-2 w-full cursor-pointer accent-primary"
                            disabled={duration <= 0}
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{formatSeconds(progressValue)}</span>
                            <span>{formatSeconds(duration)}</span>
                        </div>
                    </div>
                </div>
            )}

            <audio ref={audioRef} src={src} preload="metadata" />
        </div>
    );
}
