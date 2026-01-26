import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';

export default function Dashboard() {
    const { t } = useTranslation();
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

    const handleLogout = async () => {
        await authClient.signOut();
        navigate('/');
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-4xl mx-auto flex flex-col items-center">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-12 rounded-3xl shadow-xl text-center w-full"
                >
                    <h1 className="text-4xl font-bold text-slate-900 mb-6">
                        {t('dashboard.welcome')}, {user?.name || 'Parent'}
                    </h1>
                    <p className="text-slate-500 mb-2">
                        Username: @{user?.username}
                    </p>
                    <p className="text-slate-500 mb-8">
                        This is the temporary hub for your co-parenting communication.
                    </p>
                    <Button variant="outline" onClick={handleLogout}>
                        {t('dashboard.logout')}
                    </Button>
                </motion.div>
            </div>
        </div>
    );
}
