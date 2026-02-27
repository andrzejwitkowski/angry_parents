import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ChevronLeft,
    Calendar,
    Clock,
    User,
    Mail,
    FileText,
    History,
    Save,
    CheckCircle2,
    AlertCircle,
    Activity,
    Play,
    UserCheck,
    MailOpen,
    MailX,
    UserPlus,
    HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
    RegistrationStatus,
    REGISTRATION_STATUS_CONFIG,
    ParentRegistrationStatus,
    PARENT_REGISTRATION_STATUS_ORDER,
} from "@/types/registration";


interface TimelineEvent {
    type: string;
    message: string;
    timestamp: string;
}

interface RegistrationDetails {
    _id: string;
    familyName: string;
    dadName?: string;
    dadEmail?: string;
    momName?: string;
    momEmail?: string;
    status: string;
    dadStatus: ParentRegistrationStatus;
    momStatus: ParentRegistrationStatus;
    adminNotes: string;
    timeline: TimelineEvent[];
    dadToken?: string;
    momToken?: string;
    createdAt: string;
    updatedAt: string;
}

const AdminRegistrationDetails: React.FC = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        try {
            const response = await fetch(`/api/admin/registrations/${id}`);
            if (response.ok) {
                const data = await response.json();
                setRegistration(data);
                setNote(data.adminNotes || "");
            }
        } catch (error) {
            console.error("Error fetching registration details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNote = async () => {
        setIsSavingNote(true);
        try {
            const response = await fetch(`/api/admin/registrations/${id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: note }),
            });
            if (response.ok) {
                fetchDetails();
            }
        } catch (error) {
            console.error("Error saving notes:", error);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleForceComplete = async () => {
        if (!confirm(t('admin.confirm_force_complete'))) return;

        try {
            const response = await fetch(`/api/admin/registrations/${id}/complete`, {
                method: "POST",
            });
            if (response.ok) {
                fetchDetails();
            }
        } catch (error) {
            console.error("Error completing registration:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!registration) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-2xl font-bold">{t('admin.registration_not_found')}</h2>
                <Button asChild className="mt-4">
                    <Link to="/admin">{t('common.back')}</Link>
                </Button>
            </div>
        );
    }

    const currentStatusConfig = REGISTRATION_STATUS_CONFIG[registration.status as RegistrationStatus] || { color: "gray", icon: "HelpCircle" };

    const StatusIcon = ({ status, className }: { status: string, className?: string }) => {
        const config = REGISTRATION_STATUS_CONFIG[status as RegistrationStatus] || { color: "gray", icon: "HelpCircle" };
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

    // Step color config with static classes for Tailwind JIT compatibility
    const STEP_STYLE: Record<ParentRegistrationStatus, { bg: string; text: string; border: string; line: string }> = {
        [ParentRegistrationStatus.INVITATION_SENT]: {
            bg: "bg-purple-500",
            text: "text-purple-600",
            border: "border-purple-300",
            line: "bg-purple-500",
        },
        [ParentRegistrationStatus.EMAIL_OPENED]: {
            bg: "bg-cyan-500",
            text: "text-cyan-600",
            border: "border-cyan-300",
            line: "bg-cyan-500",
        },
        [ParentRegistrationStatus.REGISTERED]: {
            bg: "bg-green-500",
            text: "text-green-600",
            border: "border-green-300",
            line: "bg-green-500",
        },
    };

    const STEP_ICONS: Record<ParentRegistrationStatus, React.ReactNode> = {
        [ParentRegistrationStatus.INVITATION_SENT]: <Mail className="w-4 h-4" />,
        [ParentRegistrationStatus.EMAIL_OPENED]: <MailOpen className="w-4 h-4" />,
        [ParentRegistrationStatus.REGISTERED]: <CheckCircle2 className="w-4 h-4" />,
    };

    const STEP_LABELS: Record<ParentRegistrationStatus, string> = {
        [ParentRegistrationStatus.INVITATION_SENT]: t("admin.step.invitation_sent"),
        [ParentRegistrationStatus.EMAIL_OPENED]: t("admin.step.email_opened"),
        [ParentRegistrationStatus.REGISTERED]: t("admin.step.registered"),
    };

    const ParentProgressRow = ({
        parentLabel,
        icon,
        status,
    }: {
        parentLabel: string;
        icon: React.ReactNode;
        status: ParentRegistrationStatus;
    }) => {
        const currentIndex = PARENT_REGISTRATION_STATUS_ORDER.indexOf(status);

        return (
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {parentLabel}
                    </span>
                </div>
                {/* Grid: N equal columns so circles spread across full container width */}
                <div
                    className="relative grid"
                    style={{ gridTemplateColumns: `repeat(${PARENT_REGISTRATION_STATUS_ORDER.length}, 1fr)` }}
                >
                    {/* Background line: runs between centers of first and last circle (50%/N from each edge) */}
                    <div
                        className="absolute h-0.5 bg-border top-5"
                        style={{
                            left: `calc(100% / ${PARENT_REGISTRATION_STATUS_ORDER.length * 2})`,
                            right: `calc(100% / ${PARENT_REGISTRATION_STATUS_ORDER.length * 2})`,
                        }}
                    />
                    {/* Active progress line */}
                    {currentIndex > 0 && (
                        <div
                            className={`absolute h-0.5 top-5 transition-all duration-700 ${STEP_STYLE[status]?.line ?? "bg-gray-400"}`}
                            style={{
                                left: `calc(100% / ${PARENT_REGISTRATION_STATUS_ORDER.length * 2})`,
                                width: `calc(${currentIndex} * (100% - 100% / ${PARENT_REGISTRATION_STATUS_ORDER.length}) / ${PARENT_REGISTRATION_STATUS_ORDER.length - 1})`,
                            }}
                        />
                    )}
                    {PARENT_REGISTRATION_STATUS_ORDER.map((stepStatus, idx) => {
                        const isDone = currentIndex > idx;
                        const isCurrent = currentIndex === idx;
                        const isPending = currentIndex < idx;
                        const style = STEP_STYLE[stepStatus];

                        return (
                            <div key={stepStatus} className="flex flex-col items-center gap-2 z-10">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 shrink-0
                                        ${isDone || isCurrent
                                            ? `${style.bg} text-white border-transparent ${isCurrent ? "ring-2 ring-offset-2 ring-offset-card " + style.border + " scale-110 shadow-md" : ""}`
                                            : "bg-muted text-muted-foreground border-border"
                                        }`}
                                >
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : STEP_ICONS[stepStatus]}
                                </div>
                                <span
                                    className={`text-[10px] font-semibold uppercase tracking-wide text-center leading-tight
                                        ${isPending ? "text-muted-foreground opacity-50" : style.text}`}
                                >
                                    {STEP_LABELS[stepStatus]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="sm" asChild className="hover:bg-primary/5">
                    <Link to="/admin" className="flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" />
                        {t('common.back')}
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">
                        {t('admin.details_title', { id: registration._id.slice(-6) })}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t('admin.details_desc')}</p>
                </div>
                <div className="flex gap-3">
                    {registration.status !== RegistrationStatus.COMPLETED && (
                        <Button variant="outline" onClick={handleForceComplete} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                            <AlertCircle className="w-4 h-4 mr-2" />
                            {t('admin.force_complete')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Info Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Registration Progress Card */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-primary" />
                                {t('admin.registration_progress')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <ParentProgressRow
                                parentLabel={t('admin.parent_dad')}
                                icon={<User className="w-4 h-4" />}
                                status={registration.dadStatus ?? ParentRegistrationStatus.INVITATION_SENT}
                            />
                            <div className="border-t border-border/50" />
                            <ParentProgressRow
                                parentLabel={t('admin.parent_mom')}
                                icon={<User className="w-4 h-4" />}
                                status={registration.momStatus ?? ParentRegistrationStatus.INVITATION_SENT}
                            />
                        </CardContent>
                    </Card>

                    {/* Family Info */}
                    <Card className="border-border/50 shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full bg-${currentStatusConfig.color}-500`} />
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                                <Calendar className="w-4 h-4" />
                                {t('admin.familyName')}
                            </CardTitle>
                            <Badge className={`bg-${currentStatusConfig.color}-500/10 text-${currentStatusConfig.color}-500 border-${currentStatusConfig.color}-500/20 px-4 py-1.5 text-sm`}>
                                <div className="flex items-center gap-2">
                                    <StatusIcon status={registration.status} className="w-4 h-4" />
                                    {t(`admin.status.${registration.status}`)}
                                </div>
                            </Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-extrabold truncate">{registration.familyName}</p>
                            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                <Clock className="w-3.5 h-3.5" />
                                {t('common.created')}: {format(new Date(registration.createdAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <History className="w-5 h-5 text-indigo-500" />
                                {t('admin.timeline')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {registration.timeline.map((event, idx) => (
                                    <div key={idx} className="flex gap-4 relative">
                                        {idx !== registration.timeline.length - 1 && (
                                            <div className="absolute left-[17px] top-8 w-0.5 h-calc[100%+24px] bg-border/40" />
                                        )}
                                        <div className={`
                                            w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10
                                            bg-${REGISTRATION_STATUS_CONFIG[event.type as RegistrationStatus]?.color || 'gray'}-500/10 
                                            text-${REGISTRATION_STATUS_CONFIG[event.type as RegistrationStatus]?.color || 'gray'}-500
                                            border border-${REGISTRATION_STATUS_CONFIG[event.type as RegistrationStatus]?.color || 'gray'}-500/20
                                        `}>
                                            <StatusIcon status={event.type} className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-1 pb-4">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-foreground/90">{event.message}</h4>
                                                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded uppercase font-bold">
                                                    {t(`admin.status.${event.type}`)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {format(new Date(event.timestamp), "HH:mm:ss", { locale: pl })}
                                                <span className="opacity-50 mx-1">•</span>
                                                {format(new Date(event.timestamp), "dd MMMM yyyy", { locale: pl })}
                                            </p>
                                        </div>
                                    </div>
                                )).reverse()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    {/* Admin Notes */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5 text-amber-500" />
                                {t('admin.notes')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder={t('admin.add_note_placeholder')}
                                className="min-h-[200px] resize-none focus:ring-amber-500/20"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                            <Button
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                                onClick={handleSaveNote}
                                disabled={isSavingNote}
                            >
                                {isSavingNote ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Save className="w-4 h-4" />
                                        {t('admin.save_note')}
                                    </div>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Developer Tools (Dev only) */}
                    {(registration.dadToken || registration.momToken) && (
                        <Card className="border-purple-200 bg-purple-50/30 overflow-hidden">
                            <CardHeader className="pb-3 bg-purple-100/50">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-purple-700 uppercase tracking-wider">
                                    <Activity className="w-4 h-4" />
                                    Dev Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                {registration.dadToken && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-purple-600 uppercase">Rejestracja Taty:</p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 bg-white"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${registration.dadToken}`;
                                                    window.open(url, '_blank');
                                                }}
                                            >
                                                Otwórz Link
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-white"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${registration.dadToken}`;
                                                    navigator.clipboard.writeText(url);
                                                }}
                                            >
                                                Kopiuj
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {registration.momToken && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-purple-600 uppercase">Rejestracja Mamy:</p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 bg-white"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${registration.momToken}`;
                                                    window.open(url, '_blank');
                                                }}
                                            >
                                                Otwórz Link
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-white"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/auth?token=${registration.momToken}`;
                                                    navigator.clipboard.writeText(url);
                                                }}
                                            >
                                                Kopiuj
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminRegistrationDetails;
