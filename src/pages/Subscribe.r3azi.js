import { verifyTransaction } from 'backend/paystack.web';
import wixLocation from 'wix-location';
import wixUsers from 'wix-users';
import wixWindow from 'wix-window';

$w.onReady(async function () {
  const reference = wixLocation.query.reference;

  if (!reference) {
    $w('#statusText').text = "No payment reference found in URL.";
    return;
  }

  $w('#statusText').text = "Verifying payment...";

  try {
    const result = await verifyTransaction(reference);

    if (result.success) {
      $w('#statusText').text = `Payment verified for ${result.email}. Redirecting...`;

      // Optionally: Add delay to show message
      setTimeout(() => {
        wixLocation.to("/dashboard"); // Replace with your actual dashboard page path
      }, 2500);
    } else {
      $w('#statusText').text = "Verification failed.";
    }
  } catch (err) {
    console.error(err);
    $w('#statusText').text = "An error occurred during verification.";
  }
});
