import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RegistrationStatus, REGISTRATION_STATUS_ORDER, REGISTRATION_STATUS_CONFIG } from "@/types/registration";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Label } from '@/components/ui/label';
import {
    Plus,
    Users,
    Activity,
    Search,
    ChevronRight,
    Play,
    UserCheck,
    Mail,
    MailOpen,
    MailX,
    UserPlus,
    CheckCircle2,
    HelpCircle,
    ArrowRight,
    X
} from "lucide-react";
import { Link } from "react-router-dom";

interface RegistrationProcess {
    _id: string;
    familyName: string;
    dadName?: string;
    dadEmail?: string;
    momName?: string;
    momEmail?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    dadToken?: string; // Dad registration token
    momToken?: string; // Mom registration token
}

const AdminPage: React.FC = () => {
    const { t } = useTranslation();
    const [registrations, setRegistrations] = useState<RegistrationProcess[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state for new registration
    const [dadEmail, setDadEmail] = useState("");
    const [momEmail, setMomEmail] = useState("");
    const [familyName, setFamilyName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastInitiated, setLastInitiated] = useState<{ id: string, dadToken: string, momToken: string, familyName: string, dadPreviewHtml?: string, momPreviewHtml?: string } | null>(null);

    useEffect(() => {
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        try {
            const response = await fetch("/api/admin/registrations");
            if (response.ok) {
                const data = await response.json();
                setRegistrations(data);
            }
        } catch (error) {
            console.error("Error fetching registrations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await fetch("/api/admin/registrations/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dadEmail, momEmail, familyName }),
            });
            if (response.ok) {
                const data = await response.json();
                // Reset form and refresh list
                setDadEmail("");
                setMomEmail("");
                setFamilyName("");
                setLastInitiated({
                    id: data._id,
                    dadToken: data.dadToken,
                    momToken: data.momToken,
                    familyName: data.familyName || t('common.familyDefault'),
                    dadPreviewHtml: data.dadPreviewHtml,
                    momPreviewHtml: data.momPreviewHtml
                });
                fetchRegistrations();
            }
        } catch (error) {
            console.error("Error starting registration:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRegistrations = registrations.filter(reg =>
        reg.familyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reg.dadName && reg.dadName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (reg.momName && reg.momName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (reg.dadEmail && reg.dadEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (reg.momEmail && reg.momEmail.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getStatusConfig = (status: string) => {
        return REGISTRATION_STATUS_CONFIG[status as RegistrationStatus] || { color: "gray", icon: "HelpCircle" };
    };

    const getProgress = (status: string) => {
        const order = REGISTRATION_STATUS_ORDER;
        const index = order.indexOf(status as RegistrationStatus);
        if (index === -1) return 0;
        return ((index + 1) / order.length) * 100;
    };

    const StatusIcon = ({ status, className }: { status: string, className?: string }) => {
        const config = getStatusConfig(status);
        const IconComponent = {
            Play,
            UserCheck,
            Mail,
            MailOpen,
            MailX,
            UserPlus,
            CheckCircle2,
            HelpCircle
        }[config.icon] || HelpCircle;

        return <IconComponent className={className} />;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 bg-background min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t('admin.dashboard')}</h1>
                    <p className="text-muted-foreground mt-2">{t('admin.registrations_desc', 'Zarządzaj procesami rejestracji nowych rodzin.')}</p>
                </div>
                <div className="flex gap-4">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="py-2 px-4 flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{registrations.length} {t('admin.registrations')}</span>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: List and Search */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                    {t('admin.activeProcesses')}
                                </CardTitle>
                                <div className="relative w-64">
                                    <Search className="absolute left-2 top-2.5 h-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder={t('common.search', 'Szukaj...')}
                                        className="pl-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : filteredRegistrations.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    {t('common.noResults', 'Nie znaleziono procesów.')}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {filteredRegistrations.map((reg) => (
                                        <Link
                                            key={reg._id}
                                            to={`/admin/registrations/${reg._id}`}
                                            className="block group"
                                        >
                                            <div className="p-4 border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                            {reg.familyName}
                                                        </h3>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                            <span className="font-medium text-foreground/80">{reg.dadName || reg.momName || t('common.waiting')}</span>
                                                            <span>•</span>
                                                            <span>{reg.dadEmail || reg.momEmail}</span>
                                                        </div>
                                                    </div>
                                                    <Badge className={`bg-${getStatusConfig(reg.status).color}-500/10 text-${getStatusConfig(reg.status).color}-500 border-${getStatusConfig(reg.status).color}-500/20 px-3 py-1`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <StatusIcon status={reg.status} className="w-3.5 h-3.5" />
                                                            {t(`admin.status.${reg.status}`)}
                                                        </div>
                                                    </Badge>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full bg-${getStatusConfig(reg.status).color}-500 transition-all duration-500 ease-out`}
                                                            style={{ width: `${getProgress(reg.status)}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">
                                                            {t('common.updated')}: {formatDistanceToNow(new Date(reg.updatedAt), { addSuffix: true, locale: pl })}
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            {reg.dadToken && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const url = `${window.location.origin}/auth?token=${reg.dadToken}`;
                                                                        navigator.clipboard.writeText(url);
                                                                    }}
                                                                >
                                                                    <Mail className="w-3 h-3 mr-1" />
                                                                    Kopiuj Link Taty
                                                                </Button>
                                                            )}
                                                            {reg.momToken && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const url = `${window.location.origin}/auth?token=${reg.momToken}`;
                                                                        navigator.clipboard.writeText(url);
                                                                    }}
                                                                >
                                                                    <Mail className="w-3 h-3 mr-1" />
                                                                    Kopiuj Link Mamy
                                                                </Button>
                                                            )}
                                                            <div className="flex items-center gap-1 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                                                {t('admin.details')}
                                                                <ChevronRight className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Quick Actions / Start New */}
                <div className="space-y-6">
                    <Card className="border-primary/20 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Plus className="w-24 h-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Plus className="w-5 h-5 text-primary" />
                                {t('admin.startRegistration')}
                            </CardTitle>
                            <CardDescription>
                                {t('admin.startRegistration_desc', 'Zainicjuj proces dla nowej rodziny.')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleStartRegistration} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">E-mail Taty</label>
                                    <Input
                                        type="email"
                                        placeholder="tata@example.com"
                                        value={dadEmail}
                                        onChange={(e) => setDadEmail(e.target.value)}
                                        required
                                        className="bg-background/50 focus:bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">E-mail Mamy</label>
                                    <Input
                                        type="email"
                                        placeholder="mama@example.com"
                                        value={momEmail}
                                        onChange={(e) => setMomEmail(e.target.value)}
                                        required
                                        className="bg-background/50 focus:bg-background"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">{t('admin.familyName')}</label>
                                    <Input
                                        placeholder={t('common.familyDefault')}
                                        value={familyName}
                                        onChange={(e) => setFamilyName(e.target.value)}
                                        className="bg-background/50 focus:bg-background"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full shadow-md hover:shadow-lg transition-all"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? t('invite.sending') : (
                                        <div className="flex items-center gap-2">
                                            {t('admin.initiate')}
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Success Message Card (Dev only) */}
                    {lastInitiated && (
                        <Card className="border-green-500/50 bg-green-500/5 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2 text-green-700">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <CardTitle className="text-base font-bold">{t('admin.success.title')}</CardTitle>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-green-700 hover:bg-green-500/10"
                                    onClick={() => setLastInitiated(null)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-green-800">
                                    {t('admin.success.body', { familyName: lastInitiated.familyName })}
                                </p>

                                <div className="space-y-2 pt-2 border-t border-green-500/20">
                                    <Label className="text-xs font-bold text-green-800 uppercase tracking-wider flex items-center justify-between">
                                        {t('admin.success.sendDad')}
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                            onClick={() => {
                                                const url = `${window.location.origin}/auth?token=${lastInitiated.dadToken}`;
                                                window.open(url, '_blank');
                                            }}
                                        >
                                            {t('admin.success.openLink')}
                                        </Button>
                                    </Label>

                                    {lastInitiated.dadPreviewHtml ? (
                                        <div className="border border-green-500/30 rounded-md overflow-hidden bg-white shadow-inner h-[200px]">
                                            <iframe
                                                srcDoc={lastInitiated.dadPreviewHtml}
                                                className="w-full h-full border-0"
                                                title="Dad Email Preview"
                                                sandbox="allow-same-origin"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                readOnly
                                                value={`${window.location.origin}/auth?token=${lastInitiated.dadToken}`}
                                                className="bg-white/50 border-green-500/30 text-xs font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0 bg-white hover:bg-green-50"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${lastInitiated.dadToken}`;
                                                    navigator.clipboard.writeText(url);
                                                }}
                                            >
                                                <Mail className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 pt-2 border-t border-green-500/20">
                                    <Label className="text-xs font-bold text-green-800 uppercase tracking-wider flex items-center justify-between">
                                        {t('admin.success.sendMom')}
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                                            onClick={() => {
                                                const url = `${window.location.origin}/auth?token=${lastInitiated.momToken}`;
                                                window.open(url, '_blank');
                                            }}
                                        >
                                            {t('admin.success.openLink')}
                                        </Button>
                                    </Label>

                                    {lastInitiated.momPreviewHtml ? (
                                        <div className="border border-green-500/30 rounded-md overflow-hidden bg-white shadow-inner h-[200px]">
                                            <iframe
                                                srcDoc={lastInitiated.momPreviewHtml}
                                                className="w-full h-full border-0"
                                                title="Mom Email Preview"
                                                sandbox="allow-same-origin"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                readOnly
                                                value={`${window.location.origin}/auth?token=${lastInitiated.momToken}`}
                                                className="bg-white/50 border-green-500/30 text-xs font-mono"
                                            />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="shrink-0 bg-white hover:bg-green-50"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${lastInitiated.momToken}`;
                                                    navigator.clipboard.writeText(url);
                                                }}
                                            >
                                                <Mail className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Quick Stats Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('admin.quickStats', 'Szybkie Statystyki')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center px-2 py-1">
                                <span className="text-sm text-muted-foreground">{t('admin.totalFamilies')}</span>
                                <span className="font-bold">{registrations.length}</span>
                            </div>
                            <div className="flex justify-between items-center px-2 py-1">
                                <span className="text-sm text-muted-foreground">{t('admin.completedFlows')}</span>
                                <span className="font-bold text-green-500">
                                    {registrations.filter(r => r.status === "COMPLETED").length}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
