import { useState } from "react";
import { Calendar as CalendarIcon, Loader2, ArrowRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CustodyEntry, CustodyPatternConfig } from "@/types/custody";

// Mock Child for now, or fetch from ChildrenConfigSheet state/context
const MOCK_CHILD = { id: "c1", name: "Alice" };

export function CustodyScheduler() {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<Partial<CustodyPatternConfig>>({
        childId: MOCK_CHILD.id,
        type: "ALTERNATING_WEEKEND",
        startingParent: "DAD",
        handoverTime: "17:00"
    });
    const [previewEntries, setPreviewEntries] = useState<CustodyEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const handleGeneratePreview = async () => {
        if (!config.startDate || !config.endDate || !config.type) return;

        setLoading(true);
        try {
            const res = await fetch("http://localhost:3000/api/custody/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                const data = await res.json();
                setPreviewEntries(data);
                setStep(2);
            } else {
                console.error("Failed to generate preview");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Custody Scheduler</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuration Form */}
                <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-200">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Pattern Configuration
                        </CardTitle>
                        <CardDescription>Choose a template or define a custom rotation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Pattern Selection Cards */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pattern Type</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => setConfig({ ...config, type: 'ALTERNATING_WEEKEND' })}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 gap-2 h-24",
                                        config.type === 'ALTERNATING_WEEKEND'
                                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <div className="p-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                                        <CalendarIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-semibold text-center leading-tight">Alt. Weekend</span>
                                </button>

                                <button
                                    onClick={() => setConfig({ ...config, type: 'TWO_TWO_THREE', sequence: undefined })}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 gap-2 h-24",
                                        config.type === 'TWO_TWO_THREE'
                                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <div className="p-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-semibold text-center leading-tight">2-2-3 Rotation</span>
                                </button>

                                <button
                                    onClick={() => setConfig({ ...config, type: 'CUSTOM_SEQUENCE', sequence: [1, 13] })}
                                    className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 gap-2 h-24",
                                        config.type === 'CUSTOM_SEQUENCE'
                                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <div className="p-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                                        <Settings className="w-4 h-4" /> {/* Ensure Settings is imported */}
                                    </div>
                                    <span className="text-xs font-semibold text-center leading-tight">Custom Loop</span>
                                </button>
                            </div>
                        </div>


                        {/* Custom Sequence Input */}
                        {config.type === 'CUSTOM_SEQUENCE' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Days On / Off Pattern</Label>
                                <div className="relative">
                                    <Input
                                        className="pl-3 pr-20 font-mono text-sm border-slate-200 focus-visible:ring-indigo-500"
                                        value={config.sequence?.join(', ') || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const nums = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                                            if (nums.length > 0) setConfig({ ...config, sequence: nums });
                                        }}
                                        placeholder="e.g. 1, 13"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                                        days
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    Enter numbers separated by comma. Example: "1, 13" means 1 day assigned, 13 days off.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</Label>
                                <Input
                                    type="date"
                                    className="block w-full border-slate-200 focus-visible:ring-indigo-500"
                                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</Label>
                                <Input
                                    type="date"
                                    className="block w-full border-slate-200 focus-visible:ring-indigo-500"
                                    onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Starting Parent</Label>
                                <Select
                                    onValueChange={(v: 'MOM' | 'DAD') => setConfig({ ...config, startingParent: v })}
                                    defaultValue={config.startingParent}
                                >
                                    <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                                        <SelectValue placeholder="Select parent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MOM">Mom</SelectItem>
                                        <SelectItem value="DAD">Dad</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Handover</Label>
                                <Input
                                    type="time"
                                    className="border-slate-200 focus-visible:ring-indigo-500"
                                    value={config.handoverTime}
                                    onChange={(e) => setConfig({ ...config, handoverTime: e.target.value })}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02]"
                            size="lg"
                            onClick={handleGeneratePreview}
                            disabled={loading || !config.startDate || !config.endDate}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                            Generate Schedule
                        </Button>
                    </CardContent>
                </Card>
                {/* Preview / Results */}
                <Card className="h-full border-0 shadow-lg bg-white ring-1 ring-slate-100 flex flex-col">
                    <CardHeader>
                        <CardTitle>Schedule Preview</CardTitle>
                        <CardDescription>
                            {previewEntries.length > 0
                                ? `Generated ${previewEntries.length} entries.`
                                : "Configure pattern to see preview."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 overflow-hidden">
                        <div className="h-full overflow-y-auto space-y-2 pr-2">
                            {previewEntries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 text-sm hover:bg-slate-50 transition-colors">
                                    <div className="flex gap-3 items-center">
                                        <span className="font-semibold text-slate-700 w-24">{entry.date}</span>
                                        <span className="text-slate-400 text-xs">
                                            {entry.startTime} - {entry.endTime}
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider",
                                        entry.assignedTo === 'MOM' ? "bg-pink-100 text-pink-700 ring-1 ring-pink-200" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                                    )}>
                                        {entry.assignedTo}
                                    </span>
                                </div>
                            ))}
                            {previewEntries.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                    <CalendarIcon className="w-16 h-16 mb-4 opacity-10" />
                                    <p className="font-medium">No schedule generated yet</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
