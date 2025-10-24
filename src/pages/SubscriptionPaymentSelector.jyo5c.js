// PayFastLightbox.js
import wixWindow from 'wix-window';
import { generateSimplePayFastUrl } from 'backend/payfastUtils.jsw';

let userId;

$w.onReady(async function () {
  const receivedData = wixWindow.lightbox.getContext();
  userId = receivedData?.userId;

  if (!userId) {
    console.error("❌ Missing userId in lightbox context.");
    wixWindow.lightbox.close(null);
    return;
  }

  try {
    const payfastUrl = await generateSimplePayFastUrl(userId);
    wixWindow.lightbox.close(payfastUrl); // send URL back to page
  } catch (err) {
    console.error("❌ Failed to generate PayFast URL:", err);
    wixWindow.openLightbox("Message", { message: "⚠️ Payment process failed. Please try again." });
  }
});
