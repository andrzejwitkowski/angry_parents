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
    Settings as SettingsIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
    const { t, i18n } = useTranslation();

    const handleLanguageChange = (value: string) => {
        i18n.changeLanguage(value);
        localStorage.setItem("i18nextLng", value);
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
