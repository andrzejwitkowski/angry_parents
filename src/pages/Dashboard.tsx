import { useNavigate } from 'react-router-dom';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { BetterCalendar } from '@/components/BetterCalendar';

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            const session = await authClient.getSession();
            if (!session.data) {
                navigate('/auth');
            } else {
                setUser(session.data.user);
            }
            setLoading(false);
        };
        checkSession();
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

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans antialiased text-slate-900">
            {/* Sidebar Component */}
            <Sidebar user={user} />

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto p-4 md:p-8 lg:p-12 transition-all duration-300">
                <div className="max-w-[1600px] mx-auto h-full flex flex-col">
                    {/* Header/Breadcrumbs can go here */}
                    <div className="mb-8 flex items-end justify-between">
                        <div>
                            <h1 className="text-xl font-medium text-slate-400">Dashboard</h1>
                            <p className="text-3xl font-bold text-slate-900">Co-Parenting Hub</p>
                        </div>
                        <div className="hidden md:block">
                            <span className="text-sm font-medium text-slate-400 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>

                    {/* Calendar Component */}
                    <div className="flex-1 min-h-0">
                        <BetterCalendar user={user} />
                    </div>
                </div>
            </main>
        </div>
    );
}
