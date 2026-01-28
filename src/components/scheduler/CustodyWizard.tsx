import { useState } from "react";
import { Calendar as CalendarIcon, Loader2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
                <Card>
                    <CardHeader>
                        <CardTitle>Pattern Configuration</CardTitle>
                        <CardDescription>Define the recurring custody schedule.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pattern Type</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={config.type === 'ALTERNATING_WEEKEND' ? 'default' : 'outline'}
                                    onClick={() => setConfig({ ...config, type: 'ALTERNATING_WEEKEND' })}
                                    className="flex-1"
                                >
                                    Alt. Weekend
                                </Button>
                                <Button
                                    variant={config.type === 'CUSTOM_SEQUENCE' ? 'default' : 'outline'}
                                    onClick={() => setConfig({ ...config, type: 'CUSTOM_SEQUENCE', sequence: [2, 2, 3] })}
                                    className="flex-1"
                                >
                                    2-2-3
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Starting Parent</Label>
                                <Select
                                    onValueChange={(v: 'MOM' | 'DAD') => setConfig({ ...config, startingParent: v })}
                                    defaultValue={config.startingParent}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select parent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MOM">Mom</SelectItem>
                                        <SelectItem value="DAD">Dad</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Handover Time</Label>
                                <Input
                                    type="time"
                                    value={config.handoverTime}
                                    onChange={(e) => setConfig({ ...config, handoverTime: e.target.value })}
                                />
                            </div>
                        </div>

                        <Button
                            className="w-full mt-4"
                            onClick={handleGeneratePreview}
                            disabled={loading || !config.startDate || !config.endDate}
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Preview
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview / Results */}
                <Card>
                    <CardHeader>
                        <CardTitle>Schedule Preview</CardTitle>
                        <CardDescription>
                            {previewEntries.length > 0
                                ? `Generated ${previewEntries.length} entries.`
                                : "Configure pattern to see preview."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[400px] overflow-y-auto space-y-2 pr-2">
                            {previewEntries.map(entry => (
                                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                                    <div className="flex gap-2 items-center">
                                        <span className="font-semibold w-24">{entry.date}</span>
                                        <span className="text-gray-500">
                                            {entry.startTime} - {entry.endTime}
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-1 rounded text-xs font-bold",
                                        entry.assignedTo === 'MOM' ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        {entry.assignedTo}
                                    </span>
                                </div>
                            ))}
                            {previewEntries.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <CalendarIcon className="w-12 h-12 mb-2 opacity-20" />
                                    <p>No schedule generated yet</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
