import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ChevronLeft,
    MoreHorizontal,
    Globe,
    User,
    Bell,
    Home,
    Calendar,
    MessageSquare,
    Settings as SettingsIcon,
    ShieldCheck,
    Key,
    Lock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api/auth";
import { getPrivateKey } from "@/lib/idb-crypto";
import { loginWithPasskey } from "@/lib/webauthn-client";
import { useSecurity } from "@/context/SecurityContext";

interface UserProfile {
    id: string;
    email: string;
    name: string;
    gender: "mom" | "dad";
}

export default function Settings() {
    const { t, i18n } = useTranslation();
    const [localUnlocked, setLocalUnlocked] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [parentStatuses, setParentStatuses] = useState({ mom: false, dad: false, current: false });
    const [user, setUser] = useState<UserProfile | null>(null);

    const { configTimeout, updateConfig, isLocked, resetTimer, clearExpiryFlag } = useSecurity();

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const { user: me, family } = await authApi.getMe();
                setUser(me);
                const pk = await getPrivateKey(me.id);
                setLocalUnlocked(!!pk);
                if (family) {
                    const statuses = {
                        mom: family.parentPublicKeys.some(k => k.role === 'mom'),
                        dad: family.parentPublicKeys.some(k => k.role === 'dad'),
                        current: family.parentPublicKeys.some(k => k.parentId === me.id)
                    };
                    setParentStatuses(statuses);
                } else {
                    setParentStatuses({ mom: false, dad: false, current: false });
                }
            } catch (e) {
                setLocalUnlocked(false);
                setParentStatuses({ mom: false, dad: false, current: false });
                console.error("Failed to fetch settings status", e);
            }
        };
        fetchStatus();
    }, [isLocked]); // Re-fetch when lock state changes

    const handleLanguageChange = (value: string) => {
        i18n.changeLanguage(value);
        localStorage.setItem("i18nextLng", value);
    };

    const handleUnlock = async () => {
        if (!user) return;
        setIsUnlocking(true);
        try {
            // Re-trigger login with PRF to unlock
            const success = await loginWithPasskey(user.email);
            if (success) {
                const pk = await getPrivateKey(user.id);
                setLocalUnlocked(!!pk);
                if (pk) {
                    resetTimer();
                    clearExpiryFlag();
                }
            } else {
                setLocalUnlocked(false);
            }
        } catch (e) {
            setLocalUnlocked(false);
            console.error("Unlock failed", e);
        } finally {
            setIsUnlocking(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-20">
            {/* Mobile Header */}
            <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="p-1 -ml-1 text-slate-500 hover:text-primary transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-lg font-semibold tracking-tight">{t('settings.title')}</h1>
                </div>
                <div className="flex items-center">
                    <MoreHorizontal className="w-6 h-6 text-slate-400" />
                </div>
            </header>

            <main className="max-w-md mx-auto px-4 py-6 space-y-6">
                {/* Language Preference Card */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center gap-4 space-y-0">
                        <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <Globe className="w-8 h-8" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">{t('settings.language.title')}</CardTitle>
                            <CardDescription className="text-xs">{t('settings.language.description')}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                        <div className="space-y-2">
                            <Select value={i18n.language} onValueChange={handleLanguageChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">{t('settings.language.english')}</SelectItem>
                                    <SelectItem value="pl">{t('settings.language.polish')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Encryption Settings Card */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center gap-4 space-y-0">
                        <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <ShieldCheck className="w-8 h-8" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">{t('settings.encryption.title')}</CardTitle>
                            <CardDescription className="text-xs">{t('settings.encryption.description')}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="flex flex-col gap-3">
                            {/* Parent Statuses */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${parentStatuses.mom ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span className="text-sm font-medium">{t('settings.encryption.momStatus')}</span>
                                </div>
                                <span className="text-xs text-slate-500">{parentStatuses.mom ? t('settings.encryption.registered') : t('settings.encryption.unregistered')}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${parentStatuses.dad ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                    <span className="text-sm font-medium">{t('settings.encryption.dadStatus')}</span>
                                </div>
                                <span className="text-xs text-slate-500">{parentStatuses.dad ? t('settings.encryption.registered') : t('settings.encryption.unregistered')}</span>
                            </div>

                            {/* Local Device Status */}
                            <div className="mt-2 p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-indigo-500" />
                                        <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">{t('settings.encryption.localStatus')}</span>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full ${localUnlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                                    >
                                        {localUnlocked ? t('settings.encryption.unlocked') : t('settings.encryption.locked')}
                                    </span>
                                </div>
                                {!localUnlocked && parentStatuses.current && (
                                    <Button
                                        data-testid="unlock-button"
                                        size="sm"
                                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
                                        onClick={handleUnlock}
                                        disabled={isUnlocking}
                                    >
                                        <Lock className="w-4 h-4 mr-2" />
                                        {isUnlocking ? t("settings.encryption.unlocking") : t('settings.encryption.unlockButton')}
                                    </Button>
                                )}
                                {!parentStatuses.current && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2"
                                        asChild
                                    >
                                        <Link to="/setup-passkey">
                                            {t('settings.encryption.setupButton')}
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Session Security Card */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center gap-4 space-y-0">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                    <Lock className="w-8 h-8" />
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold">{t('settings.security.title')}</CardTitle>
                                    <CardDescription className="text-xs">{t('settings.security.timeoutDesc')}</CardDescription>
                                </div>
                            </div>
                            <div
                                data-testid="session-lock-status"
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isLocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                            >
                                {isLocked ? t('settings.encryption.locked') : t('settings.encryption.unlocked')}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('settings.security.timeout')}</label>
                            <Select value={configTimeout.toString()} onValueChange={(v) => updateConfig(parseInt(v, 10))}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t('settings.security.selectTimeout')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="120">{t('settings.security.2m')}</SelectItem>
                                    <SelectItem value="300">{t('settings.security.5m')}</SelectItem>
                                    <SelectItem value="600">{t('settings.security.10m')}</SelectItem>
                                    <SelectItem value="1800">{t('settings.security.30m')}</SelectItem>
                                    <SelectItem value="3600">{t('settings.security.1h')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Navigation Placeholder (Desktop Sidebar Equiv) */}
                <div className="pt-4 grid grid-cols-2 gap-3">
                    <button className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 hover:bg-slate-50 transition-colors">
                        <User className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-medium">Profile</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 hover:bg-slate-50 transition-colors">
                        <Bell className="w-6 h-6 text-slate-400" />
                        <span className="text-xs font-medium">Notifications</span>
                    </button>
                </div>
            </main>

            {/* Bottom Navigation Bar (iOS style) */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-6 py-3 pb-8 flex justify-between items-center z-50">
                <Link to="/dashboard" className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <Home className="w-6 h-6" />
                    <span className="text-[10px]">Dashboard</span>
                </Link>
                <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <Calendar className="w-6 h-6" />
                    <span className="text-[10px]">Calendar</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-primary">
                    <MessageSquare className="w-6 h-6" />
                    <span className="text-[10px]">Messages</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-blue-500">
                    <SettingsIcon className="w-6 h-6" />
                    <span className="text-[10px] font-semibold">{t('settings.title')}</span>
                </button>
            </nav>
        </div>
    );
}
