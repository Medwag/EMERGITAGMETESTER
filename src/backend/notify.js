// backend/notify.jsw
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';

export async function sendWhatsAppAlert(toPhone, message) {
    try {
        const token = await getSecret("meta_whatsapp_token");  // saved in Secrets Manager
        const phoneNumberId = await getSecret("meta_whatsapp_number_id"); // from Meta Business Account

        if (!token || !phoneNumberId) {
            console.error("WhatsApp secrets missing in Secrets Manager");
            return { success: false, error: "Secrets not configured" };
        }

        const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

        const body = {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "text",
            text: { body: message }
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            return { success: true, status: await response.json() };
        } else {
            const err = await response.json();
            console.error("WhatsApp API error:", err);
            return { success: false, error: err };
        }
    } catch (err) {
        console.error("WhatsApp send error:", err);
        return { success: false, error: err.message };
    }
}
