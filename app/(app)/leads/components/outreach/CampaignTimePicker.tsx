"use client";

import { useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMinutesFromMidnightTo12Hour } from "@/utils/dateandtimes";
import { fromMinutes, toMinutes } from "./time-utils";

type PickerStage = "hour" | "minute";
type Meridiem = "AM" | "PM";

const HOUR_VALUES = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
const MINUTE_VALUES = Array.from({ length: 12 }, (_, index) => index * 5);

function getHour12(hour24: number): number {
    const normalizedHour = ((Math.floor(hour24) % 24) + 24) % 24;
    return normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
}

function getMeridiem(hour24: number): Meridiem {
    return hour24 >= 12 ? "PM" : "AM";
}

function toHour24(hour12: number, meridiem: Meridiem): number {
    const normalizedHour = hour12 % 12;
    return meridiem === "PM" ? normalizedHour + 12 : normalizedHour;
}

function snapMinuteToFive(minute: number): number {
    return Math.round(minute / 5) * 5 === 60
        ? 55
        : Math.max(0, Math.round(minute / 5) * 5);
}

function polarStyle(index: number, total: number, radius: number) {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    return {
        left: `calc(50% + ${Math.cos(angle) * radius}px)`,
        top: `calc(50% + ${Math.sin(angle) * radius}px)`,
        transform: "translate(-50%, -50%)",
    };
}

export function CampaignTimePicker({
    label,
    value,
    onChange,
    disabled = false,
    className,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const [stage, setStage] = useState<PickerStage>("hour");
    const initialValue = useMemo(() => fromMinutes(value), [value]);
    const [draftHour24, setDraftHour24] = useState(initialValue.hour);
    const [draftMinute, setDraftMinute] = useState(
        snapMinuteToFive(initialValue.minute),
    );

    const meridiem = getMeridiem(draftHour24);
    const selectedHour12 = getHour12(draftHour24);
    const handAngle =
        stage === "hour"
            ? ((selectedHour12 % 12) / 12) * 360
            : (draftMinute / 60) * 360;

    const applyValue = () => {
        onChange(toMinutes(draftHour24, draftMinute));
        setOpen(false);
    };

    const syncDraftFromValue = () => {
        const next = fromMinutes(value);
        setDraftHour24(next.hour);
        setDraftMinute(snapMinuteToFive(next.minute));
        setStage("hour");
    };

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            syncDraftFromValue();
        }
        setOpen(nextOpen);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => handleOpenChange(true)}
                disabled={disabled}
                className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-[1.15rem] border border-white/10 bg-[#111827]/85 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-primary/40 hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-60",
                    className,
                )}
            >
                <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                        {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-50">
                        {formatMinutesFromMidnightTo12Hour(value)}
                    </p>
                </div>
                <span className="flex size-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Clock3 className="size-5" />
                </span>
            </button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="overflow-hidden border-white/10 bg-[#0a1220] p-0 text-slate-50 sm:max-w-[420px]">
                    <DialogHeader className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(22,32,51,0.96),rgba(10,18,32,0.96))] px-6 py-5 text-left">
                        <DialogTitle className="text-xl font-semibold tracking-tight">
                            {label}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Pick the hour first, then refine the exact minute.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 px-6 py-6">
                        <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                                    Selected time
                                </p>
                                <div className="mt-2 flex items-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStage("hour")}
                                        className={cn(
                                            "cursor-pointer text-4xl font-semibold tracking-tight transition",
                                            stage === "hour"
                                                ? "text-primary"
                                                : "text-slate-100/85",
                                        )}
                                    >
                                        {String(selectedHour12).padStart(2, "0")}
                                    </button>
                                    <span className="pb-1 text-3xl text-slate-500">:</span>
                                    <button
                                        type="button"
                                        onClick={() => setStage("minute")}
                                        className={cn(
                                            "cursor-pointer text-4xl font-semibold tracking-tight transition",
                                            stage === "minute"
                                                ? "text-primary"
                                                : "text-slate-100/85",
                                        )}
                                    >
                                        {String(draftMinute).padStart(2, "0")}
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                {(["AM", "PM"] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() =>
                                            setDraftHour24(
                                                toHour24(selectedHour12, value),
                                            )
                                        }
                                        className={cn(
                                            "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium tracking-[0.2em] transition",
                                            meridiem === value
                                                ? "border-primary/50 bg-primary text-primary-foreground"
                                                : "border-white/10 bg-transparent text-slate-300 hover:border-white/20",
                                        )}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.14),transparent_0,transparent_42%),linear-gradient(180deg,rgba(22,32,51,0.92),rgba(9,14,27,0.96))] p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                                        {stage === "hour" ? "Hour" : "Minute"}
                                    </p>
                                    <p className="mt-1 text-sm text-slate-300">
                                        {stage === "hour"
                                            ? "Choose the hour on the dial."
                                            : "Choose the minute on the dial or switch back to the hour."}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {([
                                        { key: "hour", label: "Hour" },
                                        { key: "minute", label: "Minute" },
                                    ] as const).map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setStage(item.key)}
                                            className={cn(
                                                "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition",
                                                stage === item.key
                                                    ? "border-primary/40 bg-primary/15 text-primary"
                                                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200",
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative mx-auto size-[290px] rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_62%)]">
                                <div className="absolute left-1/2 top-1/2 h-[2px] w-[112px] origin-left rounded-full bg-primary/75"
                                    style={{
                                        transform: `translateY(-50%) rotate(${handAngle - 90}deg)`,
                                    }}
                                />
                                <div className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#0a1220] bg-primary" />

                                {stage === "hour"
                                    ? HOUR_VALUES.map((hourValue, index) => {
                                          const selected = selectedHour12 === hourValue;
                                          return (
                                              <button
                                                  key={hourValue}
                                                  type="button"
                                                  onClick={() => {
                                                      setDraftHour24(
                                                          toHour24(hourValue, meridiem),
                                                      );
                                                      setStage("minute");
                                                  }}
                                                  className={cn(
                                                      "absolute flex size-11 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition",
                                                      selected
                                                          ? "bg-primary text-primary-foreground shadow-[0_0_24px_rgba(251,191,36,0.45)]"
                                                          : "text-slate-200 hover:bg-white/10",
                                                  )}
                                                  style={polarStyle(index, 12, 112)}
                                              >
                                                  {hourValue}
                                              </button>
                                          );
                                      })
                                    : MINUTE_VALUES.map((minute) => {
                                          const selected = minute === draftMinute;
                                          return (
                                              <button
                                                  key={minute}
                                                  type="button"
                                                  onClick={() => setDraftMinute(minute)}
                                                  aria-label={`${String(minute).padStart(2, "0")} minutes`}
                                                  className={cn(
                                                      "absolute flex size-10 cursor-pointer items-center justify-center rounded-full text-xs font-medium transition",
                                                      selected
                                                          ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(251,191,36,0.4)]"
                                                          : "text-slate-300 hover:bg-white/10",
                                                  )}
                                                  style={polarStyle(minute / 5, 12, 112)}
                                              >
                                                  {String(minute).padStart(2, "0")}
                                              </button>
                                          );
                                      })}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 bg-[#0b1323] px-6 py-4">
                        <p className="text-sm text-slate-400">
                            {formatMinutesFromMidnightTo12Hour(toMinutes(draftHour24, draftMinute))}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-slate-300 hover:bg-white/10 hover:text-slate-50"
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" className="rounded-full" onClick={applyValue}>
                                Apply time
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
