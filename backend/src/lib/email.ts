import path from "path";
import fs from "fs";

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
    token: string,
    familyName: string,
    lang: "pl" | "en" = "pl",
    trackingToken?: string
): Promise<{ link: string; html: string }> {
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
    const link = `${baseUrl}/auth?token=${token}`;
    const imageBaseUrl = `${backendUrl}/api/assets/children.jpg`;
    const imageUrl = trackingToken ? `${imageBaseUrl}?t=${trackingToken}` : imageBaseUrl;

    // Load locales
    const localesPath = path.join(process.cwd(), "src/locales", `${lang}.json`);
    const translations = JSON.parse(fs.readFileSync(localesPath, "utf-8")).translation;

    const t = (key: string, data?: any) => {
        let val = translations[key] || key;
        if (data) {
            Object.keys(data).forEach(k => {
                val = val.replace(`{{${k}}}`, data[k]);
            });
        }
        return val;
    };

    const imagePath = path.join(process.cwd(), "backend/src/assets/children.jpg");

    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6; background-color: #f9f9f7; padding: 20px; border-radius: 8px;">
            <div style="text-align: center; padding: 20px 0;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 24px;">${t("email.parentA.title")}</h1>
                <p style="color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; margin-top: 5px; font-weight: 600;">
                    ${t("email.parentA.subtitle")}
                </p>
            </div>
            
            <div style="margin-bottom: 25px; text-align: center;">
                <img src="${IS_DEV ? imageUrl : 'cid:children_image'}" alt="Children" style="width: 70%; display: inline-block;" />
            </div>

            <div style="padding: 0 10px;">
                <p style="font-size: 16px;">${t("email.parentA.greeting")}</p>
                <p>${t("email.parentA.body1", { familyName })}</p>
                <p>${t("email.parentA.body2")}</p>
                
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" style="background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);">
                        ${t("email.parentA.button")}
                    </a>
                </div>

                <p style="color: #6b7280; font-size: 13px;">
                    ${t("email.parentA.manualLink")}<br>
                    <a href="${link}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; word-break: break-all;">${link}</a>
                </p>

                <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 25px;">
                    <h3 style="font-size: 14px; margin-bottom: 10px; color: #111827;">🔒 ${t("email.security.title")}</h3>
                    <p style="font-size: 13px; color: #4b5563; margin: 0;">
                        ${t("email.security.body")}
                    </p>
                </div>

                <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} Wspolne-wychowanie. Wszystkie prawa zastrzeżone.</p>
                </div>
            </div>
        </div>
    `;

    // Attachments for image
    const emailOptions: any = {
        to,
        subject: t("email.parentA.subject", { familyName }),
        html,
    };

    if (!IS_DEV) {
        emailOptions.attachments = [{
            filename: 'children.jpg',
            path: imagePath,
            cid: 'children_image'
        }];
    } else {
        console.log(`[CID Attachment] children_image -> ${imagePath}`);
    }

    await sendEmail(emailOptions);

    return { link, html };
}

// Keep the old name as alias or remove if fully refactored. 
// I'll update call sites.
export { sendInvitationEmail as sendParentAInitiationEmail };
