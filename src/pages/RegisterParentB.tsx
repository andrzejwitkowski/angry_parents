import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi, type Gender } from '@/lib/api/auth';
import { KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';

export default function RegisterParentB() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invitationData, setInvitationData] = useState<{
        tempToken: string;
        tempFamilyId: string;
        tempCreatedByGender: Gender;
    } | null>(null);
    const [gender, setGender] = useState<Gender>('mom');
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (!tokenParam) {
            setError(t("registerB.noToken"));
            return;
        }

        const fetchOptions = async () => {
            try {
                const data = await authApi.registerParentBOptions(tokenParam);
                setInvitationData(data);
                
                const oppositeGender = data.tempCreatedByGender === 'mom' ? 'dad' : 'mom';
                setGender(oppositeGender);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : t("registerB.invalidToken");
                setError(msg);
            }
        };

        fetchOptions();
    }, [searchParams, t]);

    const handleRegister = async () => {
        if (!invitationData) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const result = await authApi.registerParentBVerify({
                registrationResponse: {},
                tempToken: invitationData.tempToken,
                tempFamilyId: invitationData.tempFamilyId,
                tempCreatedByGender: invitationData.tempCreatedByGender,
                gender,
                mock: true,
            });

            if (result.verified) {
                setVerified(true);
                setTimeout(() => navigate('/dashboard'), 1500);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("registerB.failed");
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    if (error && !invitationData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-red-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                            <AlertCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <CardTitle className="text-2xl">{t("registerB.error")}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-slate-600">{error}</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" onClick={() => navigate('/auth')}>
                            {t("registerB.backToLogin")}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                        <KeyRound className="w-10 h-10 text-indigo-600" />
                    </div>
                    <CardTitle className="text-2xl">{t("registerB.title")}</CardTitle>
                    <CardDescription>{t("registerB.description")}</CardDescription>
                </CardHeader>
                
                {verified ? (
                    <CardContent className="text-center">
                        <div className="bg-green-100 text-green-700 p-4 rounded-lg">
                            <p className="font-medium">{t("registerB.success")}</p>
                            <p className="text-sm mt-1">{t("registerB.redirecting")}</p>
                        </div>
                    </CardContent>
                ) : (
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                                {error}
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t("registerB.selectGender")}</p>
                            <div className="flex gap-4">
                                <label className={`flex-1 cursor-pointer border-2 rounded-lg p-3 text-center transition-colors ${
                                    gender === 'dad' 
                                        ? 'border-indigo-600 bg-indigo-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}>
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="dad"
                                        checked={gender === 'dad'}
                                        onChange={() => setGender('dad')}
                                        className="sr-only"
                                    />
                                    <span className={gender === 'dad' ? 'text-indigo-700 font-medium' : 'text-slate-600'}>
                                        {t("auth.dad")}
                                    </span>
                                </label>
                                <label className={`flex-1 cursor-pointer border-2 rounded-lg p-3 text-center transition-colors ${
                                    gender === 'mom' 
                                        ? 'border-pink-600 bg-pink-50' 
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}>
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="mom"
                                        checked={gender === 'mom'}
                                        onChange={() => setGender('mom')}
                                        className="sr-only"
                                    />
                                    <span className={gender === 'mom' ? 'text-pink-700 font-medium' : 'text-slate-600'}>
                                        {t("auth.mom")}
                                    </span>
                                </label>
                            </div>
                        </div>
                    </CardContent>
                )}
                
                {!verified && (
                    <CardFooter className="flex flex-col gap-3">
                        <Button 
                            className="w-full" 
                            onClick={handleRegister} 
                            disabled={isLoading || !invitationData}
                        >
                            <KeyRound className="w-4 h-4 mr-2" />
                            {isLoading ? t("registerB.registering") : t("registerB.registerWithKey")}
                        </Button>
                        
                        {import.meta.env.DEV && (
                            <Button
                                variant="outline"
                                className="w-full border-dashed border-slate-300"
                                onClick={handleRegister}
                                disabled={isLoading || !invitationData}
                            >
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                {t("auth.devSimulateRegister")}
                            </Button>
                        )}
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
