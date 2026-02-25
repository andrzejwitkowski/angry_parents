import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";

const AdminPage = () => {
    const { t } = useTranslation();
    const [processes, setProcesses] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [parentAName, setParentAName] = useState("");
    const [parentAEmail, setParentAEmail] = useState("");
    const [startingRole, setStartingRole] = useState("Dad");

    useEffect(() => {
        fetchProcesses();
        fetchLogs();
    }, []);

    const fetchProcesses = async () => {
        try {
            const data = await api.get("/admin/registrations");
            setProcesses(data);
        } catch (e) {
            console.error("Failed to fetch processes", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const data = await api.get("/admin/logs");
            setLogs(data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    const handleStartRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post("/admin/registrations/start", {
                parentName: parentAName,
                parentEmail: parentAEmail,
                role: startingRole
            });
            setParentAName("");
            setParentAEmail("");
            fetchProcesses();
            fetchLogs();
        } catch (e) {
            console.error("Failed to start registration", e);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "FLOW_STARTED": return "bg-blue-50 text-blue-700 border-blue-200";
            case "PARENT_A_VALIDATED": return "bg-indigo-50 text-indigo-700 border-indigo-200";
            case "INVITATION_SENT": return "bg-purple-50 text-purple-700 border-purple-200";
            case "PARENT_B_REGISTERED": return "bg-orange-50 text-orange-700 border-orange-200";
            case "COMPLETED": return "bg-green-50 text-green-700 border-green-200";
            default: return "bg-zinc-50 text-zinc-700 border-zinc-200";
        }
    };

    const getProgress = (status: string) => {
        const order = ["FLOW_STARTED", "PARENT_A_VALIDATED", "INVITATION_SENT", "PARENT_B_REGISTERED", "COMPLETED"];
        const index = order.indexOf(status);
        return ((index + 1) / order.length) * 100;
    };

    return (
        <div className="min-h-screen bg-white p-8 text-zinc-900">
            <div className="mx-auto max-w-6xl space-y-8">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t("admin.dashboard")}</h1>
                        <p className="text-zinc-500">{t("admin.description", { defaultValue: "Manage onboarding and registration flows." })}</p>
                    </div>
                </header>

                <Tabs defaultValue="registrations" className="space-y-6">
                    <TabsList className="bg-zinc-100 border-zinc-200">
                        <TabsTrigger value="registrations">{t("admin.registrations")}</TabsTrigger>
                        <TabsTrigger value="logs">{t("admin.logs")}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="registrations" className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-3">
                            <Card className="bg-white border-zinc-200 md:col-span-1 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-zinc-900">{t("admin.startRegistration")}</CardTitle>
                                    <CardDescription className="text-zinc-500">{t("admin.initiate_desc", { defaultValue: "Create a new family bucket and send Parent A link." })}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleStartRegistration} className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700">{t("admin.parentName")}</label>
                                            <Input
                                                value={parentAName}
                                                onChange={e => setParentAName(e.target.value)}
                                                className="bg-white border-zinc-200 text-zinc-900"
                                                placeholder="e.g. John Doe"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700">{t("admin.parentEmail")}</label>
                                            <Input
                                                type="email"
                                                value={parentAEmail}
                                                onChange={e => setParentAEmail(e.target.value)}
                                                className="bg-white border-zinc-200 text-zinc-900"
                                                placeholder="john@example.com"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700">{t("auth.gender")}</label>
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant={startingRole === "Dad" ? "default" : "outline"}
                                                    onClick={() => setStartingRole("Dad")}
                                                    className="w-full h-9"
                                                >
                                                    {t("auth.dad")}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={startingRole === "Mom" ? "default" : "outline"}
                                                    onClick={() => setStartingRole("Mom")}
                                                    className="w-full h-9"
                                                >
                                                    {t("auth.mom")}
                                                </Button>
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                                            {t("admin.initiate")}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-zinc-200 md:col-span-2 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-zinc-900">{t("admin.activeProcesses")}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader className="border-zinc-200 bg-zinc-50/50">
                                            <TableRow className="hover:bg-transparent border-zinc-100">
                                                <TableHead className="text-zinc-500 font-semibold">{t("admin.parentName")}</TableHead>
                                                <TableHead className="text-zinc-500 font-semibold">Status</TableHead>
                                                <TableHead className="text-zinc-500 font-semibold">Progress</TableHead>
                                                <TableHead className="text-zinc-500 font-semibold text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-zinc-500">
                                                        {t("dashboard.loading")}
                                                    </TableCell>
                                                </TableRow>
                                            ) : processes.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-zinc-500">
                                                        No registration processes found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                processes.map((p) => (
                                                    <TableRow key={p._id} className="hover:bg-zinc-50 border-zinc-100 transition-colors">
                                                        <TableCell className="font-medium text-zinc-900">
                                                            {p.parentAName}
                                                            <div className="text-xs text-zinc-500 font-normal">{p.parentAEmail}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`${getStatusColor(p.status)} font-medium`}>
                                                                {t(`admin.status.${p.status}`)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="w-[120px]">
                                                            <div className="space-y-1">
                                                                <Progress value={getProgress(p.status)} className="h-1 bg-zinc-100" />
                                                                <div className="text-[10px] text-zinc-500 text-right font-medium">{Math.round(getProgress(p.status))}%</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                                                                onClick={() => window.location.href = `/admin/registrations/${p._id}`}
                                                            >
                                                                {t("admin.details")}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="logs">
                        <Card className="bg-white border-zinc-200 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-zinc-900">{t("admin.logs")}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader className="border-zinc-200 bg-zinc-50/50">
                                        <TableRow className="hover:bg-transparent border-zinc-100">
                                            <TableHead className="text-zinc-500 font-semibold">Time</TableHead>
                                            <TableHead className="text-zinc-500 font-semibold">Type</TableHead>
                                            <TableHead className="text-zinc-500 font-semibold">Context</TableHead>
                                            <TableHead className="text-zinc-500 font-semibold">Message</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-zinc-500">No logs found</TableCell>
                                            </TableRow>
                                        ) : (
                                            logs.map((log, i) => (
                                                <TableRow key={i} className="hover:bg-zinc-50 border-zinc-100 transition-colors">
                                                    <TableCell className="text-zinc-500 text-xs font-medium">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] uppercase bg-zinc-50 text-zinc-700 border-zinc-200 font-bold">{log.type}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-zinc-500 text-xs font-medium">
                                                        {log.parentAName}
                                                    </TableCell>
                                                    <TableCell className="text-zinc-800 text-sm font-medium">
                                                        {log.message}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default AdminPage;
