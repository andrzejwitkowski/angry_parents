const IS_DEV = process.env.NODE_ENV !== "production";

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, html } = options;

    if (IS_DEV) {
        console.log("========================================");
        console.log("[DEV EMAIL]");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:`);
        console.log(html);
        console.log("========================================");
        return;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.FROM_EMAIL || "noreply@angry-parents.app";

    if (!smtpHost || !smtpUser || !smtpPass) {
        console.error("[Email] SMTP not configured, falling back to dev log");
        console.log(`[DEV EMAIL] To: ${to}, Subject: ${subject}`);
        return;
    }

    const nodemailer = await import("nodemailer");
    
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || "587"),
        secure: smtpPort === "465",
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
    });
}

export async function sendInvitationEmail(
    to: string,
    inviteToken: string,
    inviterName: string
): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const link = `${baseUrl}/register?token=${inviteToken}`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Zaproszenie do współrodzicielstwa</h2>
            <p>Cześć!</p>
            <p><strong>${inviterName}</strong> zaprosił/a Cię do wspólnej opieki nad dziećmi.</p>
            <p>Kliknij poniższy link, aby zarejestrować się:</p>
            <p>
                <a href="${link}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Zarejestruj się
                </a>
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Link ważny przez 7 dni.<br>
                Jeśli to nie Ty, zignoruj tę wiadomość.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
                — Team Angry Parents
            </p>
        </div>
    `;

    await sendEmail({
        to,
        subject: "Zaproszenie do Angry Parents - rejestracja",
        html,
    });

    return link;
}
