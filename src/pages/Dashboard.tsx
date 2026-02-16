import { useNavigate } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { checkHasPasskey } from '@/lib/webauthn-client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { BetterCalendar } from '@/components/BetterCalendar';
import type { User } from '@/types/user';
import { ChildrenConfigSheet } from '@/components/settings/ChildrenConfigSheet';
import { CustodyScheduler } from '@/components/scheduler/CustodyWizard';

import {
    Bell,
    Gavel,
    MapPin,
    Users,
    ChevronRight
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const session = await authClient.getSession();
                if (!session.data) {
                    navigate('/auth');
                    return;
                }

                setUser(session.data.user);

                // Check if user has registered a hardware key
                const hasKey = await checkHasPasskey();
                if (!hasKey) {
                    navigate('/setup-passkey');
                }
            } catch (error) {
                console.error("Auth check failed", error);
                navigate('/auth');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Loading Workspace...</p>
                </div>
            </div>
        );
    }

    const handleScheduleSaved = () => {
        setIsWizardOpen(false);
        setCalendarRefreshKey(prev => prev + 1);
    };

    return (
        <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans antialiased text-slate-900 dark:text-slate-100">
            {/* Sidebar Component - Fixed Width */}
            <div className="flex-shrink-0 h-full">
                <Sidebar user={user} />
            </div>

            {/* Main Content Area - Flex Column */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <div className="flex flex-col h-full px-6 md:px-8 py-6 gap-6">

                    {/* Header & Overview Section - Fixed Height (Shrink 0) */}
                    <div className="flex-shrink-0 space-y-6">
                        {/* Header */}
                        <header className="flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
                                <p className="text-xs font-medium text-indigo-500/80 dark:text-indigo-400/80">Premium Access</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <ChildrenConfigSheet />
                                <button className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-500 transition-colors">
                                    <Bell className="w-5 h-5" />
                                </button>
                                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 overflow-hidden bg-slate-200">
                                    {user?.image ? (
                                        <img alt="User Profile" className="w-full h-full object-cover" src={user.image} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold">
                                            {user?.name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* Overview Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Generate Schedule Card */}
                            <div className="lg:col-span-1">
                                <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
                                    <DialogTrigger asChild>
                                        <button className="w-full h-[120px] p-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20 flex flex-col justify-between group transition-all duration-200 active:scale-[0.98]">
                                            <div className="flex justify-between items-start w-full">
                                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                                    <Gavel className="w-5 h-5 text-white" />
                                                </div>
                                                <ChevronRight className="w-5 h-5 opacity-60 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                            <div className="text-left space-y-0.5">
                                                <h3 className="font-bold text-base">Input Court Schedule</h3>
                                                <p className="text-indigo-100 text-xs font-medium">Input your court-ordered custody plan</p>
                                            </div>
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                        <CustodyScheduler onSave={handleScheduleSaved} />
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {/* Today's Overview Card - Reduced Height */}
                            <div className="lg:col-span-2">
                                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 h-[120px] relative overflow-hidden flex items-center">
                                    <div className="absolute top-0 right-0 p-3">
                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                            Next Up
                                        </span>
                                    </div>
                                    <div className="flex gap-5 items-center relative z-10 w-full">
                                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <MapPin className="w-7 h-7" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Handover at 4:00 PM</h3>
                                            <div className="flex items-center gap-3">
                                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Central Park South</p>
                                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3 h-3 text-slate-400" />
                                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Leo & Maya</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Container - Fills Remaining Space */}
                    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                        <div className="absolute top-4 left-6 z-10 pointer-events-none">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custody Calendar</span>
                        </div>
                        {/* BetterCalendar should handle its own internal scrolling if needed, or fit 100% height */}
                        <div className="h-full w-full pt-8">
                            <BetterCalendar user={user} refreshKey={calendarRefreshKey} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
