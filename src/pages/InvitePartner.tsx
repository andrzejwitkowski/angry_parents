import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/lib/api/auth';
import { Copy, Mail, Check, UserPlus } from 'lucide-react';

export default function InvitePartner() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await authApi.invite(email);
            setInviteLink(result.link);

            if (result.previewHtml) {
                const blob = new Blob([result.previewHtml], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : t("invite.error");
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async () => {
        if (inviteLink) {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const skipAndGoToDashboard = () => {
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-indigo-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                        <UserPlus className="w-10 h-10 text-indigo-600" />
                    </div>
                    <CardTitle className="text-2xl">{t("invite.title")}</CardTitle>
                    <CardDescription>{t("invite.description")}</CardDescription>
                </CardHeader>

                {!inviteLink ? (
                    <form onSubmit={handleInvite}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="partner-email">{t("invite.partnerEmail")}</Label>
                                <Input
                                    id="partner-email"
                                    type="email"
                                    placeholder="partner@example.com"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3">
                            <Button className="w-full" type="submit" disabled={isLoading}>
                                <Mail className="w-4 h-4 mr-2" />
                                {isLoading ? t("invite.sending") : t("invite.sendInvite")}
                            </Button>

                            <Button variant="outline" onClick={skipAndGoToDashboard} disabled={isLoading}>
                                {t("invite.skip")}
                            </Button>
                        </CardFooter>
                    </form>
                ) : (
                    <CardContent className="space-y-4">
                        <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg border border-green-100 text-center">
                            <Check className="w-5 h-5 inline-block mr-2" />
                            {t("invite.sent")}
                        </div>

                        <div className="space-y-2">
                            <Label>{t("invite.linkLabel")}</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={inviteLink}
                                    readOnly
                                    className="font-mono text-xs"
                                />
                                <Button variant="outline" onClick={copyToClipboard}>
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>

                        <p className="text-sm text-slate-500 text-center">
                            {t("invite.orSendManually")}
                        </p>
                    </CardContent>
                )}

                <CardFooter className={inviteLink ? "pt-0" : ""}>
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={skipAndGoToDashboard}
                    >
                        {t("invite.goToDashboard")}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
