import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { authApi, type Gender } from '@/lib/api/auth';
import { KeyRound, ShieldCheck } from 'lucide-react';

export default function AuthPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState<Gender>('dad');

    const handleRegisterParentA = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            await authApi.registerParentAOptions({ email, name, username, gender });

            const result = await authApi.registerParentAVerify({
                registrationResponse: {},
                tempEmail: email,
                tempName: name,
                tempUsername: username,
                tempGender: gender,
                mock: true,
            });

            if (result.verified) {
                navigate('/dashboard');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("auth.regFailed");
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await authApi.devMockLogin();
            if (result.verified) {
                navigate('/dashboard');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("auth.loginFailed");
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                {error && (
                    <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-lg mb-4 text-center border border-destructive/20">
                        {error}
                    </div>
                )}

                <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
                        <TabsTrigger value="register">{t('auth.registerParentA')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('auth.login')}</CardTitle>
                                <CardDescription>{t("auth.loginDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">{t('auth.email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex flex-col gap-3">
                                <Button className="w-full" onClick={handleLogin} disabled={isLoading}>
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    {t("auth.loginWithKey")}
                                </Button>

                                {import.meta.env.DEV && (
                                    <Button
                                        variant="outline"
                                        className="w-full border-dashed border-slate-300"
                                        onClick={handleLogin}
                                        disabled={isLoading}
                                    >
                                        <ShieldCheck className="w-4 h-4 mr-2" />
                                        {t("auth.devSimulateLogin")}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    <TabsContent value="register">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('auth.registerParentA')}</CardTitle>
                                <CardDescription>{t("auth.registerParentADesc")}</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleRegisterParentA}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-name">{t("auth.fullName")}</Label>
                                        <Input
                                            id="reg-name"
                                            placeholder="Jan Kowalski"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-username">{t('auth.username')}</Label>
                                        <Input
                                            id="reg-username"
                                            placeholder="jankowalski"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-email">{t('auth.email')}</Label>
                                        <Input
                                            id="reg-email"
                                            type="email"
                                            placeholder="name@example.com"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t("auth.gender")}</Label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    value="dad"
                                                    checked={gender === 'dad'}
                                                    onChange={() => setGender('dad')}
                                                />
                                                <span className="text-indigo-600 font-medium">{t("auth.dad")}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="gender"
                                                    value="mom"
                                                    checked={gender === 'mom'}
                                                    onChange={() => setGender('mom')}
                                                />
                                                <span className="text-pink-600 font-medium">{t("auth.mom")}</span>
                                            </label>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-3">
                                    <Button className="w-full" type="submit" disabled={isLoading}>
                                        <KeyRound className="w-4 h-4 mr-2" />
                                        {isLoading ? t("auth.registering") : t("auth.registerWithKey")}
                                    </Button>

                                    {import.meta.env.DEV && (
                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed border-slate-300"
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                if (!email || !name || !gender) {
                                                    setError(t("auth.regFailed") + ": brakujące pola");
                                                    return;
                                                }
                                                setIsLoading(true);
                                                setError(null);
                                                try {
                                                    const result = await authApi.devMockRegisterA({ email, name, gender });
                                                    if (result.verified) {
                                                        navigate('/dashboard');
                                                    }
                                                } catch (err: unknown) {
                                                    const msg = err instanceof Error ? err.message : t("auth.regFailed");
                                                    setError(msg);
                                                } finally {
                                                    setIsLoading(false);
                                                }
                                            }}
                                            disabled={isLoading}
                                        >
                                            <ShieldCheck className="w-4 h-4 mr-2" />
                                            {t("auth.devSimulateRegister")}
                                        </Button>
                                    )}
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
