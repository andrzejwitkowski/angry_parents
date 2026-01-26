import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6 text-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-3xl"
            >
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
                    {t('landing.title')}
                </h1>
                <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                    {t('landing.subtitle')}
                </p>
                <div className="flex gap-4 justify-center">
                    <Button
                        size="lg"
                        className="px-8 py-6 text-lg rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
                        onClick={() => navigate('/auth')}
                    >
                        {t('landing.getStarted')}
                    </Button>
                </div>
            </motion.div>

            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
                {[
                    { title: "Secure Chat", desc: "Encrypted communication focused on children." },
                    { title: "Shared Calendar", desc: "Easy scheduling and custody tracking." },
                    { title: "Expense Tracking", desc: "Transparent financial management." }
                ].map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-sm"
                    >
                        <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                        <p className="text-slate-500">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
