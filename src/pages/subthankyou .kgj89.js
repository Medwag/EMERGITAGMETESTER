import { verifyTransaction } from 'backend/paystack.web.jsw';
import wixLocation from 'wix-location';

$w.onReady(async () => {
  const query = wixLocation.query;
  const reference = query.reference;

  if (!reference) {
    $w("#statusText").text = "No payment reference found.";
    return;
  }

  $w("#statusText").text = "Verifying payment, please wait...";

  try {
    const result = await verifyTransaction(reference);

    if (result.success) {
      $w("#statusText").text = "Payment verified successfully!";

      // Add your logic here to update the Emergency_Profiles CMS
      // e.g. create or update user profile with subscription info

      // Optionally redirect after a delay:
      // setTimeout(() => wixLocation.to('/dashboard'), 3000);
      
    } else {
      $w("#statusText").text = `Payment verification failed: ${result.message}`;
    }
  } catch (err) {
    $w("#statusText").text = "Error verifying payment. Please try again later.";
    console.error("verifyTransaction error:", err);
  }
});
