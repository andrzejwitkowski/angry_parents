import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { authClient } from '@/lib/auth-client';

export default function AuthPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        await authClient.signIn.email({
            email,
            password,
        }, {
            onSuccess: () => {
                navigate('/dashboard');
            },
            onError: (ctx) => {
                setError(ctx.error.message || "Login failed");
                setIsLoading(false);
            }
        });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        await authClient.signUp.email({
            email,
            password,
            name,
        }, {
            onSuccess: () => {
                navigate('/dashboard');
            },
            onError: (ctx) => {
                setError(ctx.error.message || "Registration failed");
                setIsLoading(false);
            }
        });
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
                        <TabsTrigger value="register">{t('auth.register')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('auth.login')}</CardTitle>
                                <CardDescription>Enter your credentials to access your account.</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleLogin}>
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
                                    <div className="space-y-2">
                                        <Label htmlFor="password">{t('auth.password')}</Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" type="submit" disabled={isLoading}>
                                        {isLoading ? "..." : t('auth.submit')}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>

                    <TabsContent value="register">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('auth.register')}</CardTitle>
                                <CardDescription>Create a new account to start communicating.</CardDescription>
                            </CardHeader>
                            <form onSubmit={handleRegister}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-name">Full Name</Label>
                                        <Input
                                            id="reg-name"
                                            placeholder="John Doe"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-username">{t('auth.username')}</Label>
                                        <Input
                                            id="reg-username"
                                            placeholder="johndoe"
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
                                        <Label htmlFor="reg-password">{t('auth.password')}</Label>
                                        <Input
                                            id="reg-password"
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button className="w-full" type="submit" disabled={isLoading}>
                                        {isLoading ? "..." : t('auth.submit')}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
