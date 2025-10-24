import { testWhatsAppSend } from 'backend/test-wa.jsw';

$w.onReady(async () => {
    const result = await testWhatsAppSend();
    console.log("💡 Test send result:", result);
});
