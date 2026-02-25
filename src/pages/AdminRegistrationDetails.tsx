import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { CheckCircle2, Clock, MapPin, Shield, User, Info, ArrowLeft, Zap } from "lucide-react";

const AdminRegistrationDetails = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [process, setProcess] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => {
        if (id) fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        try {
            const data = await api.get(`/admin/registrations/${id}`);
            setProcess(data);
            setNote(data.adminNotes || "");
        } catch (e) {
            console.error("Failed to fetch process details", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNote = async () => {
        setSavingNote(true);
        try {
            await api.post(`/admin/registrations/${id}/notes`, { notes: note });
            fetchDetails();
        } catch (e) {
            console.error("Failed to save note", e);
        } finally {
            setSavingNote(false);
        }
    };

    const handleForceComplete = async () => {
        if (!confirm("Are you sure you want to force complete this process?")) return;
        try {
            await api.post(`/admin/registrations/${id}/force-complete`);
            fetchDetails();
        } catch (e) {
            console.error("Failed to force complete", e);
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">{t("dashboard.loading")}</div>;
    if (!process) return <div className="p-8 text-center text-red-500">Process not found</div>;

    const getElapsedTime = () => {
        const start = new Date(process.createdAt);
        const now = new Date();
        const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return t("admin.days_ago", { count: diff });
    };

    const getMilestone = () => {
        const order = ["FLOW_STARTED", "PARENT_A_VALIDATED", "INVITATION_SENT", "PARENT_B_REGISTERED", "COMPLETED"];
        const index = order.indexOf(process.status);
        return t("admin.step", { count: index + 1 });
    };

    const isStepCompleted = (status: string) => {
        const order = ["FLOW_STARTED", "PARENT_A_VALIDATED", "INVITATION_SENT", "PARENT_B_REGISTERED", "COMPLETED"];
        return order.indexOf(process.status) >= order.indexOf(status);
    };

    return (
        <div className="min-h-screen bg-zinc-50/50 p-8 text-zinc-900">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="space-y-4">
                    <Button variant="ghost" onClick={() => navigate("/admin")} className="px-0 hover:bg-transparent text-zinc-500 hover:text-zinc-900">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t("common.cancel")}
                    </Button>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">
                            {t("admin.details_title", { id: process._id.slice(-4) })}
                        </h1>
                        <p className="text-zinc-500 mt-2">{t("admin.details_desc")}</p>
                    </div>
                </header>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white border-zinc-200 shadow-sm border-t-4 border-t-orange-500">
                        <CardHeader className="pb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                            {t("admin.flow_status")}
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className="text-2xl font-bold">{t("admin.in_progress")}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-zinc-200 shadow-sm border-t-4 border-t-zinc-200">
                        <CardHeader className="pb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                            {t("admin.elapsed_time")}
                        </CardHeader>
                        <CardContent>
                            <span className="text-2xl font-bold">{getElapsedTime()}</span>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-zinc-200 shadow-sm border-t-4 border-t-zinc-200">
                        <CardHeader className="pb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                            {t("admin.current_milestone")}
                        </CardHeader>
                        <CardContent>
                            <span className="text-2xl font-bold">{getMilestone()}</span>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content: Timeline */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="bg-white border-zinc-200 shadow-sm overflow-hidden">
                            <CardHeader className="border-b border-zinc-100 bg-zinc-50/50">
                                <CardTitle className="text-lg font-bold">{t("admin.timeline")}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="relative space-y-12">
                                    {/* Vertical Line */}
                                    <div className="absolute left-4 top-2 bottom-2 w-px bg-zinc-100" />

                                    {/* Timeline Steps */}
                                    {[
                                        { key: "FLOW_STARTED", icon: CheckCircle2 },
                                        { key: "PARENT_A_VALIDATED", icon: CheckCircle2 },
                                        { key: "INVITATION_SENT", icon: Clock, details: { email: process.parentAEmail, token: "XYZ789" } },
                                        { key: "PARENT_B_REGISTERED", icon: User },
                                        { key: "COMPLETED", icon: Shield }
                                    ].map((step, i) => {
                                        const completed = isStepCompleted(step.key);
                                        const current = process.status === step.key;
                                        const Icon = step.icon;

                                        return (
                                            <div key={step.key} className="relative pl-12">
                                                <div className={`absolute left-0 p-1 rounded-full border-2 bg-white z-10 
                                                    ${completed ? "border-green-500 text-green-500" : current ? "border-indigo-500 text-indigo-500" : "border-zinc-200 text-zinc-300"}`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className={`font-bold ${completed ? "text-zinc-900" : "text-zinc-400"}`}>
                                                        {t(`admin.status.${step.key}`)}
                                                    </h3>
                                                    {completed && <p className="text-xs text-zinc-400">{t("admin.status.COMPLETED")} • {getElapsedTime()}</p>}
                                                    {!completed && current && <p className="text-xs text-orange-500 font-medium">{t("admin.in_progress")}</p>}

                                                    {step.key === "INVITATION_SENT" && current && (
                                                        <div className="mt-4 p-4 rounded-xl border border-zinc-100 bg-zinc-50/50 space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-zinc-500">Email:</span>
                                                                <span className="font-medium text-zinc-900">{process.parentAEmail}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-zinc-500">Token:</span>
                                                                <code className="bg-white px-1 border border-zinc-200 rounded text-xs">XYZ789</code>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {current && step.key !== "COMPLETED" && (
                                                        <Button
                                                            onClick={handleForceComplete}
                                                            size="sm"
                                                            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100"
                                                        >
                                                            <Zap className="mr-2 h-4 w-4 fill-current" />
                                                            {t("admin.force_complete")}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar: Notes & Logs */}
                    <div className="space-y-6">
                        {/* Admin Notes */}
                        <Card className="bg-white border-zinc-200 shadow-sm">
                            <CardHeader className="flex flex-row items-center gap-2">
                                <Info className="h-5 w-5 text-indigo-600" />
                                <CardTitle className="text-sm font-bold">{t("admin.notes")}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={t("admin.add_note_placeholder")}
                                    className="min-h-[120px] bg-zinc-50/50 border-zinc-200 focus:bg-white transition-colors"
                                />
                                <Button
                                    onClick={handleSaveNote}
                                    disabled={savingNote}
                                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-bold border-none"
                                >
                                    {savingNote ? "..." : t("admin.save_note")}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Recent Process Logs */}
                        <Card className="bg-white border-zinc-200 shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-zinc-400" />
                                    <CardTitle className="text-sm font-bold">{t("admin.logs")}</CardTitle>
                                </div>
                                <Button variant="ghost" size="sm" className="text-indigo-600 font-bold text-xs h-auto p-0 hover:bg-transparent">
                                    {t("admin.view_all")}
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-zinc-50">
                                    {process.timeline?.slice().reverse().map((event: any, i: number) => (
                                        <div key={i} className="p-4 hover:bg-zinc-50/50 transition-colors">
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                                                <span className="text-zinc-900">{event.type}</span>
                                                <span className="text-zinc-400">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-xs text-zinc-600 leading-relaxed">{event.message}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminRegistrationDetails;
