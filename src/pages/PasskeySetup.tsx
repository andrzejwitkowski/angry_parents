import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { registerPasskey, checkHasPasskey, mockRegisterPasskey } from '@/lib/webauthn-client';
import { KeyRound, ShieldCheck } from 'lucide-react';

export default function PasskeySetup() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If user already has key, redirect (sanity check)
        checkHasPasskey().then(has => {
            if (has) navigate('/dashboard');
        });
    }, [navigate]);

    const handleRegister = async () => {
        setLoading(true);
        setError(null);
        try {
            await registerPasskey();
            // Success
            navigate('/dashboard');
        } catch (e: unknown) {
            console.error(e);
            const msg = e instanceof Error ? e.message : t("passkey.failedToRegister");
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-indigo-600">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                        <KeyRound className="w-10 h-10 text-indigo-600" />
                    </div>
                    <CardTitle className="text-2xl">{t("passkey.secureAccount")}</CardTitle>
                    <CardDescription>
                        {t("passkey.requireKey")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-slate-600">
                        {t("passkey.insertKey")}
                    </p>
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button
                        className="w-full py-6 text-lg cursor-pointer"
                        onClick={handleRegister}
                        disabled={loading}
                    >
                        {loading ? t("passkey.waitingForKey") : t("passkey.registerKey")}
                    </Button>

                    {import.meta.env.DEV && (
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300"
                            onClick={async () => {
                                setLoading(true);
                                try {
                                    await mockRegisterPasskey();
                                    navigate('/dashboard');
                                } catch (e: unknown) {
                                    const msg = e instanceof Error ? e.message : "Unknown error";
                                    setError(t("passkey.mockFailed", { msg }));
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        >
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            {t("passkey.devSimulateKey")}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
