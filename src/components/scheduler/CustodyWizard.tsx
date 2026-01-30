import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Loader2, ArrowRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CustodyEntry, CustodyPatternConfig, ScheduleRule } from "@/types/custody";
import { ActiveRulesList } from "./ActiveRulesList";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

// Mock Child for now, or fetch from ChildrenConfigSheet state/context
const MOCK_CHILD = { id: "c1", name: "Alice" };

export interface CustodySchedulerProps {
    onSave?: () => void;
}

export function CustodyScheduler({ onSave }: CustodySchedulerProps) {
    const [step, setStep] = useState(1);
    const [config, setConfig] = useState<Partial<CustodyPatternConfig>>({
        childId: MOCK_CHILD.id,
        type: "ALTERNATING_WEEKEND",
        startingParent: "DAD",
        handoverTime: "17:00"
    });
    const [previewEntries, setPreviewEntries] = useState<CustodyEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRules, setActiveRules] = useState<ScheduleRule[]>([]);

    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    const [conflictRules, setConflictRules] = useState<ScheduleRule[]>([]);
    const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);

    const [isPropagationDialogOpen, setIsPropagationDialogOpen] = useState(false);
    const [propagationResult, setPropagationResult] = useState<{
        canProceed: boolean;
        rulesToCreate: CustodyPatternConfig[];
        skippedRules: Array<{ ruleName: string; reason: 'ONE_TIME' | 'INVALID_DATE' }>;
    } | null>(null);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/rules?childId=${MOCK_CHILD.id}`);
            if (res.ok) {
                const data = await res.json();
                setActiveRules(data);
            }
        } catch (e) {
            console.error("Failed to fetch rules", e);
        }
    };

    const performGeneratePreview = async () => {
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
                setIsConflictDialogOpen(false); // Close dialog if open
            } else {
                console.error("Failed to generate preview");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePreview = async () => {
        if (!config.startDate || !config.endDate || !config.type) return;

        setLoading(true);
        try {
            // Check Conflicts
            const conflictRes = await fetch("http://localhost:3000/api/rules/check-conflicts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ config, excludeRuleId: editingRuleId || undefined })
            });

            if (conflictRes.ok) {
                const data = await conflictRes.json();
                if (data.conflicts && data.conflicts.length > 0) {
                    setConflictRules(data.conflicts);
                    setIsConflictDialogOpen(true);
                    setLoading(false);
                    return;
                }
            } else {
                console.error("Conflict check failed with status: " + conflictRes.status);
            }

            // No conflicts, proceed
            await performGeneratePreview();

        } catch (e) {
            console.error("Error checking conflicts", e);
            setLoading(false);
        }
    };

    const handleEditRule = (rule: ScheduleRule) => {
        setConfig(rule.config);
        setEditingRuleId(rule.id);
        setPreviewEntries([]); // Clear preview to force regeneration
        setStep(1); // Go back to config
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
    };

    const handleCancelEdit = () => {
        setEditingRuleId(null);
        setConfig({
            childId: MOCK_CHILD.id,
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD",
            handoverTime: "17:00"
        });
        setPreviewEntries([]);
    };

    const handleSaveRule = async () => {
        setLoading(true);
        try {
            // If editing, delete the old rule first
            if (editingRuleId) {
                console.log(`Deleting old rule ${editingRuleId} before update...`);
                const deleteRes = await fetch(`http://localhost:3000/api/rules/${editingRuleId}`, {
                    method: "DELETE"
                });
                if (!deleteRes.ok) {
                    throw new Error("Failed to delete old rule during update");
                }
            }

            // Create new rule
            const res = await fetch("http://localhost:3000/api/rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                console.log("Rule saved/updated successfully");
                await fetchRules(); // Refresh list
                setPreviewEntries([]); // Clear preview
                setEditingRuleId(null); // Reset edit state
                setStep(1);
                if (onSave) onSave();
            } else {
                console.error("Failed to save rule");
                window.alert("Failed to save schedule rule.");
            }
        } catch (e) {
            console.error(e);
            window.alert("Error saving rule.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        try {
            const res = await fetch(`http://localhost:3000/api/rules/${ruleId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                await fetchRules(); // Refresh list
                if (editingRuleId === ruleId) handleCancelEdit(); // Cancel edit if verifying deleted
                if (onSave) onSave(); // Trigger calendar refresh
            } else {
                window.alert("Failed to delete rule.");
            }
        } catch (e) {
            console.error(e);
            window.alert("Network error deleting rule.");
        }
    };

    const handleReorderRule = async (ruleId: string, direction: 'UP' | 'DOWN') => {
        try {
            const res = await fetch(`http://localhost:3000/api/rules/${ruleId}/reorder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ direction })
            });

            if (res.ok) {
                await fetchRules(); // Refresh list (and sorting)
                if (onSave) onSave(); // Trigger calendar refresh
            } else {
                console.error("Failed to reorder");
            }
        } catch (e) {
            console.error("Network error reordering", e);
        }
    };

    const handleCheckPropagation = async () => {
        setLoading(true);
        try {
            // Determine current month from existing rules or default to today
            // For MVP: Use the month of the first active rule, or today if none.
            // Improve: Use the latest rule's start date month.
            const pivotDate = activeRules.length > 0 ? activeRules[0].config.startDate : new Date().toISOString().split('T')[0];

            // Start of date's month
            const d = new Date(pivotDate);
            const currentMonthDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

            const res = await fetch("http://localhost:3000/api/rules/propagate/dry-run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    childId: MOCK_CHILD.id,
                    currentMonthDate: currentMonthDate
                })
            });

            if (res.ok) {
                const data = await res.json();
                setPropagationResult(data);
                setIsPropagationDialogOpen(true);
            }
        } catch (e) {
            console.error("Error checking propagation", e);
        } finally {
            setLoading(false);
        }
    };

    const handleExecutePropagation = async () => {
        if (!propagationResult) return;
        setLoading(true);
        try {
            const res = await fetch("http://localhost:3000/api/rules/propagate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rulesToCreate: propagationResult.rulesToCreate
                })
            });

            if (res.ok) {
                await fetchRules();
                setIsPropagationDialogOpen(false);
                setPropagationResult(null);
                if (onSave) onSave();
            } else {
                console.error("Failed to propagate");
            }
        } catch (e) {
            console.error("Error executing propagation", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Custody Scheduler</h1>
                <div className="text-right">
                    <p className="text-sm text-slate-500">Managing schedule for</p>
                    <p className="font-semibold text-indigo-600">{MOCK_CHILD.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Configuration (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-200">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center justify-between">
                                <span>{editingRuleId ? "Edit Pattern" : "Pattern Configuration"}</span>
                                {editingRuleId && (
                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-xs text-slate-500 h-6">
                                        Cancel Edit
                                    </Button>
                                )}
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
                                            <Settings className="w-4 h-4" />
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
                                        value={config.startDate || ''}
                                        onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">End Date</Label>
                                    <Input
                                        type="date"
                                        className="block w-full border-slate-200 focus-visible:ring-indigo-500"
                                        value={config.endDate || ''}
                                        onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Starting Parent</Label>
                                    <Select
                                        onValueChange={(v: 'MOM' | 'DAD') => setConfig({ ...config, startingParent: v })}
                                        value={config.startingParent}
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

                            <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <Checkbox
                                    id="isOneTime"
                                    checked={config.isOneTime || false}
                                    onCheckedChange={(checked) => setConfig({ ...config, isOneTime: checked as boolean })}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="isOneTime"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        One-time rule (Do not propagate)
                                    </Label>
                                    <p className="text-[11px] text-slate-500">
                                        Check this for holidays or specific events that should not repeat next month.
                                    </p>
                                </div>
                            </div>

                            <Button
                                className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02]"
                                size="lg"
                                onClick={handleGeneratePreview}
                                disabled={loading || !config.startDate || !config.endDate}
                                data-testid="generate-btn"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarIcon className="mr-2 h-4 w-4" />}
                                Generate Schedule
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Active Rules List */}
                    <div className="mt-8">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 px-1">Active Patterns</h3>
                        <ActiveRulesList
                            rules={activeRules}
                            onDelete={handleDeleteRule}
                            onEdit={handleEditRule}
                            onReorder={handleReorderRule}
                        />
                    </div>

                    {/* Propagation Control: Show only if rules exist (MVP coverage check) */}
                    {activeRules.length > 0 && (
                        <div className="mt-6 mb-2 flex justify-end">
                            <Button
                                variant="outline"
                                onClick={handleCheckPropagation}
                                className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                            >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Propagate to Next Month
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right Column: Preview (5 cols) */}
                <div className="lg:col-span-5">
                    <Card className="h-full border-0 shadow-lg bg-white ring-1 ring-slate-100 flex flex-col sticky top-6">
                        <CardHeader>
                            <div className="flex flex-col space-y-1.5 ">
                                <div className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-lg">Preview</CardTitle>
                                    {previewEntries.length > 0 && (
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => setPreviewEntries([])} variant="ghost" className="text-xs">
                                                Clear
                                            </Button>
                                            <Button size="sm" onClick={handleSaveRule} disabled={loading} className={cn(
                                                "text-white shadow-md shadow-indigo-200 text-xs",
                                                editingRuleId ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
                                            )}>
                                                {editingRuleId ? "Update Pattern" : "Confirm & Save"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <CardDescription>
                                    {previewEntries.length > 0
                                        ? `Generated ${previewEntries.length} entries.`
                                        : "Configure pattern to see preview."}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-[400px] overflow-hidden">
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
                                            "w-20 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider text-center shadow-sm",
                                            entry.assignedTo === 'MOM' ? "bg-pink-100 text-pink-700 ring-1 ring-pink-200" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
                                        )}>
                                            {entry.assignedTo}
                                        </span>
                                    </div>
                                ))}
                                {previewEntries.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                        <CalendarIcon className="w-16 h-16 mb-4 opacity-10" />
                                        <p className="font-medium text-center px-8">Select a pattern and click generate to verify before saving.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            Schedule Conflict Detected
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <p className="mb-3">This pattern overlaps with existing rules. The new rule will take priority and override the following:</p>
                            <div className="bg-slate-50 p-3 rounded-md border border-slate-100 space-y-2 max-h-[150px] overflow-y-auto">
                                {conflictRules.map(rule => (
                                    <div key={rule.id} className="flex items-center justify-between text-xs p-2 bg-white rounded shadow-sm border border-slate-100">
                                        <span className="font-medium text-slate-700">{rule.name}</span>
                                        <Badge variant="outline" className="text-[10px] h-5">P{rule.priority}</Badge>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs text-slate-500">
                                Proceeding will generate this schedule and place it at the top of the priority stack (P{activeRules.length > 0 ? Math.max(...activeRules.map(r => r.priority)) + 1 : 1}).
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={performGeneratePreview} className="bg-amber-600 hover:bg-amber-700">
                            Proceed Anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isPropagationDialogOpen} onOpenChange={setIsPropagationDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Propagate Schedule</AlertDialogTitle>
                        <AlertDialogDescription>
                            Copy existing pattern to next month?
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {propagationResult && (
                        <div className="space-y-4 my-2">
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">To Be Created</h4>
                                <div className="space-y-1">
                                    {propagationResult.rulesToCreate.map((r, i) => (
                                        <div key={i} className="text-sm bg-indigo-50 text-indigo-700 p-2 rounded border border-indigo-100 flex justify-between">
                                            <span>{r.startingParent} Starts (Pattern)</span>
                                            <span className="text-xs opacity-70">{r.startDate}</span>
                                        </div>
                                    ))}
                                    {propagationResult.rulesToCreate.length === 0 && <p className="text-xs text-slate-500 italic">No recurring rules found.</p>}
                                </div>
                            </div>

                            {propagationResult.skippedRules.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Skipped (One-Time / Invalid)</h4>
                                    <div className="space-y-1">
                                        {propagationResult.skippedRules.map((r, i) => (
                                            <div key={i} className="text-sm bg-slate-100 text-slate-500 p-2 rounded border border-slate-200 flex justify-between">
                                                <span className="line-through">{r.ruleName}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 bg-white">{r.reason === 'ONE_TIME' ? 'One Time' : 'Error'}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExecutePropagation} disabled={!propagationResult?.canProceed} data-testid="confirm-propagate-btn">
                            Confirm & Propagate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

