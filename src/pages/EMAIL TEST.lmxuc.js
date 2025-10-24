// frontend page code (e.g., test-email-page.js)
import { sendWelcomeEmail } from 'backend/sendCustomEmail.jsw';

$w.onReady(() => {
  $w('#sendTestEmailButton').onClick(async () => {
    const result = await sendWelcomeEmail();
    console.log(result.message);
    $w('#statusText').text = result.message;
  });
});
