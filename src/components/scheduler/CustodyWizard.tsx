import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Calendar as CalendarIcon, Loader2, ArrowRight, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CustodyEntry, CustodyPatternConfig, ScheduleRule } from "@/types/custody";
import { CustodyPreviewModal } from "./CustodyPreviewModal";
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
import { childApi, type Child } from "@/lib/api/children";

export interface CustodySchedulerProps {
    onSave?: () => void;
}

export function CustodyScheduler({ onSave }: CustodySchedulerProps) {
    const { t } = useTranslation();
    const [, setStep] = useState(1);
    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChild, setSelectedChild] = useState<Child | null>(null);
    const [childrenLoading, setChildrenLoading] = useState(true);
    const [config, setConfig] = useState<Partial<CustodyPatternConfig>>({
        type: "ALTERNATING_WEEKEND",
        startingParent: "DAD",
        handoverTime: "17:00",
        handoverEndTime: "19:00"
    });
    const [previewEntries, setPreviewEntries] = useState<CustodyEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
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

    const fetchChildren = React.useCallback(async () => {
        try {
            setChildrenLoading(true);
            const data = await childApi.getAll();
            setChildren(data);
            if (data.length > 0) {
                setSelectedChild(data[0]);
                setConfig(prev => ({ ...prev, childId: data[0].id }));
                fetchRules(data[0].id);
            }
        } catch (e) {
            console.error("Failed to fetch children", e);
        } finally {
            setChildrenLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChildren();
    }, [fetchChildren]);

    const handleChildSelect = (childId: string) => {
        const child = children.find(c => c.id === childId) ?? null;
        setSelectedChild(child);
        setConfig(prev => ({ ...prev, childId }));
        setPreviewEntries([]);
        setIsPreviewModalOpen(false);
        setEditingRuleId(null);
        if (child) fetchRules(child.id);
    };

    const fetchRules = async (childId: string) => {
        try {
            const res = await fetch(`http://localhost:3000/api/rules?childId=${childId}`);
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
                setIsPreviewModalOpen(true);
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
        setIsPreviewModalOpen(false);
        setStep(1); // Go back to config
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
    };

    const handleCancelEdit = () => {
        setEditingRuleId(null);
        setConfig({
            childId: selectedChild?.id,
            type: "ALTERNATING_WEEKEND",
            startingParent: "DAD",
            handoverTime: "17:00",
            handoverEndTime: "19:00"
        });
        setPreviewEntries([]);
        setIsPreviewModalOpen(false);
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
                await fetchRules(selectedChild?.id ?? ""); // Refresh list
                setPreviewEntries([]); // Clear preview
                setIsPreviewModalOpen(false);
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
                await fetchRules(selectedChild?.id ?? ""); // Refresh list
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
                await fetchRules(selectedChild?.id ?? ""); // Refresh list (and sorting)
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
                    childId: selectedChild?.id,
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
                await fetchRules(selectedChild?.id ?? "");
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

    const handleFillGaps = async (parent: 'MOM' | 'DAD') => {
        setLoading(true);
        try {
            // Determine current month from pivot date or today
            // Ideally we use the calendar's view date, but for now let's use the first rule or today
            const pivotDate = activeRules.length > 0 ? activeRules[0].config.startDate : new Date().toISOString().split('T')[0];
            const d = new Date(pivotDate);
            const monthDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

            const res = await fetch("http://localhost:3000/api/rules/fill-gaps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    childId: selectedChild?.id,
                    parent,
                    monthDate
                })
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`Filled gaps: ${data.count} rules created`);
                await fetchRules(selectedChild?.id ?? "");
                if (onSave) onSave();
            } else {
                console.error("Failed to fill gaps");
                window.alert("Failed to fill gaps.");
            }
        } catch (e) {
            console.error("Error filling gaps", e);
            window.alert("Network error filling gaps.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h1 className="text-2xl font-bold tracking-tight">{t("scheduler.title")}</h1>
                <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500 whitespace-nowrap">{t("scheduler.scheduleFor")}</p>
                    {childrenLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : children.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                            <Users className="h-4 w-4" />
                            <span>{t("scheduler.noChildren")}</span>
                        </div>
                    ) : (
                        <Select value={selectedChild?.id ?? ""} onValueChange={handleChildSelect}>
                            <SelectTrigger className="w-44 border-indigo-200 focus:ring-indigo-500">
                                <SelectValue placeholder={t("scheduler.selectChild")} />
                            </SelectTrigger>
                            <SelectContent>
                                {children.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                            {c.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto">
                {/* Configuration */}
                <div className="space-y-6">
                    <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-200">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center justify-between">
                                <span>{editingRuleId ? t("scheduler.editPattern") : t("scheduler.patternConfig")}</span>
                                {editingRuleId && (
                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-xs text-slate-500 h-6">
                                        {t("scheduler.cancelEdit")}
                                    </Button>
                                )}
                            </CardTitle>
                            <CardDescription>{t("scheduler.chooseTemplate")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Pattern Selection Cards */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.patternType")}</Label>
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
                                        <span className="text-xs font-semibold text-center leading-tight">{t("scheduler.altWeekend")}</span>
                                    </button>

                                    <button
                                        onClick={() => setConfig({ ...config, type: 'CUSTOM_BLOCK', customBlockRepeatInterval: 2, customBlockRepeatUnit: 'WEEKS', customBlockEndDayOffset: 1, sequence: undefined })}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 gap-2 h-24",
                                            config.type === 'CUSTOM_BLOCK'
                                                ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                                                : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 text-slate-600"
                                        )}
                                    >
                                        <div className="p-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                                            <CalendarIcon className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-semibold text-center leading-tight">{t("scheduler.customBlock")}</span>
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
                                        <span className="text-xs font-semibold text-center leading-tight">{t("scheduler.customLoop")}</span>
                                    </button>
                                </div>
                            </div>


                            {/* Custom Sequence Input */}
                            {config.type === 'CUSTOM_SEQUENCE' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.daysOnOff")}</Label>
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
                                            {t("scheduler.days")}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        {t("scheduler.customLoopDesc")}
                                    </p>
                                </div>
                            )}

                            {/* Custom Block Input */}
                            {config.type === 'CUSTOM_BLOCK' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.blockDuration")}</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    className="pl-3 pr-20 font-mono text-sm border-slate-200 focus-visible:ring-indigo-500"
                                                    value={config.customBlockEndDayOffset || ''}
                                                    onChange={(e) => setConfig({ ...config, customBlockEndDayOffset: parseInt(e.target.value) || 1 })}
                                                    placeholder="1"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
                                                    {t("scheduler.days")}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.repeatsEvery")}</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    className="w-20 font-mono text-sm border-slate-200 focus-visible:ring-indigo-500"
                                                    value={config.customBlockRepeatInterval || ''}
                                                    onChange={(e) => setConfig({ ...config, customBlockRepeatInterval: parseInt(e.target.value) || 1 })}
                                                    placeholder="2"
                                                />
                                                <Select
                                                    value={config.customBlockRepeatUnit || 'WEEKS'}
                                                    onValueChange={(v: 'DAYS' | 'WEEKS') => setConfig({ ...config, customBlockRepeatUnit: v })}
                                                >
                                                    <SelectTrigger className="flex-1 border-slate-200 focus:ring-indigo-500">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="DAYS">{t("scheduler.days")}</SelectItem>
                                                        <SelectItem value="WEEKS">{t("scheduler.weeks")}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.startingDay")}</Label>
                                            <Select
                                                value={config.customBlockStartDay !== undefined ? config.customBlockStartDay.toString() : 'NONE'}
                                                onValueChange={(v) => setConfig({ ...config, customBlockStartDay: v === 'NONE' ? undefined : parseInt(v) })}
                                            >
                                                <SelectTrigger className="border-slate-200 focus:ring-indigo-500">
                                                    <SelectValue placeholder={t("scheduler.matchStartDate")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">{t("scheduler.matchStartDate")}</SelectItem>
                                                    <SelectItem value="1">{t("scheduler.monday")}</SelectItem>
                                                    <SelectItem value="2">{t("scheduler.tuesday")}</SelectItem>
                                                    <SelectItem value="3">{t("scheduler.wednesday")}</SelectItem>
                                                    <SelectItem value="4">{t("scheduler.thursday")}</SelectItem>
                                                    <SelectItem value="5">{t("scheduler.friday")}</SelectItem>
                                                    <SelectItem value="6">{t("scheduler.saturday")}</SelectItem>
                                                    <SelectItem value="0">{t("scheduler.sunday")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-slate-400">
                                        {t("scheduler.customBlockDesc")}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.startDate")}</Label>
                                    <Input
                                        type="date"
                                        className="block w-full border-slate-200 focus-visible:ring-indigo-500"
                                        value={config.startDate || ''}
                                        onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.endDate")}</Label>
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
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.startingParent")}</Label>
                                    <Select
                                        onValueChange={(v: 'MOM' | 'DAD') => setConfig({ ...config, startingParent: v })}
                                        value={config.startingParent}
                                    >
                                        <SelectTrigger data-testid="starting-parent-select" className="border-slate-200 focus:ring-indigo-500">
                                            <SelectValue placeholder={t("scheduler.selectParent")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MOM">{t("scheduler.mom")}</SelectItem>
                                            <SelectItem value="DAD">{t("scheduler.dad")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("scheduler.handover")}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input
                                            type="time"
                                            className="border-slate-200 focus-visible:ring-indigo-500"
                                            value={config.handoverTime}
                                            onChange={(e) => setConfig({ ...config, handoverTime: e.target.value })}
                                            title={t("scheduler.handoverStart")}
                                        />
                                        <Input
                                            type="time"
                                            className="border-slate-200 focus-visible:ring-indigo-500"
                                            value={config.handoverEndTime || config.handoverTime}
                                            onChange={(e) => setConfig({ ...config, handoverEndTime: e.target.value })}
                                            title={t("scheduler.handoverEnd")}
                                        />
                                    </div>
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
                                        {t("scheduler.oneTime")}
                                    </Label>
                                    <p className="text-[11px] text-slate-500">
                                        {t("scheduler.oneTimeDesc")}
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
                                {t("scheduler.generateSchedule")}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Active Rules List */}
                    <div className="mt-8">
                        <h3 className="text-lg font-bold text-slate-700 mb-4 px-1">{t("scheduler.activePatterns")}</h3>
                        <ActiveRulesList
                            rules={activeRules}
                            onDelete={handleDeleteRule}
                            onEdit={handleEditRule}
                            onReorder={handleReorderRule}
                        />
                    </div>

                    {/* Fill Gaps Section */}
                    {activeRules.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-700 mb-3 px-1 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" />
                                {t("scheduler.fillGapsTitle")}
                            </h3>
                            <p className="text-xs text-slate-500 mb-4 px-1">
                                {t("scheduler.fillGapsDesc")}
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => handleFillGaps('MOM')}
                                    disabled={loading}
                                    className="border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800"
                                >
                                    {t("scheduler.fillGapsMom")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleFillGaps('DAD')}
                                    disabled={loading}
                                    className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                                >
                                    {t("scheduler.fillGapsDad")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Propagation Control: Show only if rules exist (MVP coverage check) */}
                    {activeRules.length > 0 && (
                        <div className="mt-6 mb-2 flex justify-end">
                            <Button
                                variant="outline"
                                onClick={handleCheckPropagation}
                                className="text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                            >
                                <ArrowRight className="w-4 h-4 mr-2" />
                                {t("scheduler.propagate")}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <CustodyPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                entries={previewEntries}
                config={config}
                selectedChild={selectedChild}
                onConfirm={handleSaveRule}
                isLoading={loading}
            />

            <AlertDialog open={isConflictDialogOpen} onOpenChange={setIsConflictDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                            {t("scheduler.conflictTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <p className="mb-3">{t("scheduler.conflictDesc1")}</p>
                            <div className="bg-slate-50 p-3 rounded-md border border-slate-100 space-y-2 max-h-[150px] overflow-y-auto">
                                {conflictRules.map(rule => (
                                    <div key={rule.id} className="flex items-center justify-between text-xs p-2 bg-white rounded shadow-sm border border-slate-100">
                                        <span className="font-medium text-slate-700">{rule.name}</span>
                                        <Badge variant="outline" className="text-[10px] h-5">P{rule.priority}</Badge>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs text-slate-500">
                                {t("scheduler.conflictDesc2", { priority: activeRules.length > 0 ? Math.max(...activeRules.map(r => r.priority)) + 1 : 1 })}
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("scheduler.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={performGeneratePreview} className="bg-amber-600 hover:bg-amber-700">
                            {t("scheduler.proceedAnyway")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isPropagationDialogOpen} onOpenChange={setIsPropagationDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("scheduler.propagateTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("scheduler.propagateDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {propagationResult && (
                        <div className="space-y-4 my-2">
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{t("scheduler.toBeCreated")}</h4>
                                <div className="space-y-1">
                                    {propagationResult.rulesToCreate.map((r, i) => (
                                        <div key={i} className="text-sm bg-indigo-50 text-indigo-700 p-2 rounded border border-indigo-100 flex justify-between">
                                            <span>{t("scheduler.startsPattern", { parent: t(`scheduler.${r.startingParent.toLowerCase()}`) })}</span>
                                            <span className="text-xs opacity-70">{r.startDate}</span>
                                        </div>
                                    ))}
                                    {propagationResult.rulesToCreate.length === 0 && <p className="text-xs text-slate-500 italic">{t("scheduler.noRecurring")}</p>}
                                </div>
                            </div>

                            {propagationResult.skippedRules.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">{t("scheduler.skipped")}</h4>
                                    <div className="space-y-1">
                                        {propagationResult.skippedRules.map((r, i) => (
                                            <div key={i} className="text-sm bg-slate-100 text-slate-500 p-2 rounded border border-slate-200 flex justify-between">
                                                <span className="line-through">{r.ruleName}</span>
                                                <Badge variant="outline" className="text-[10px] h-5 bg-white">{r.reason === 'ONE_TIME' ? t("scheduler.oneTimeBadge") : t("scheduler.errorBadge")}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("scheduler.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleExecutePropagation} disabled={!propagationResult?.canProceed} data-testid="confirm-propagate-btn">
                            {t("scheduler.confirmPropagate")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

