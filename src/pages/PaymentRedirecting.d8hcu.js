// ✅ PaymentRedirecting.js
// -----------------------------------------------------------
// Purpose: Safely handle transition from Wix lightbox → Paystack checkout
// Works in Wix Studio (no window object issues)
// Adds fade-in animation and visible redirect feedback
// -----------------------------------------------------------

import wixWindow from 'wix-window';
import wixLocation from 'wix-location';

// -----------------------------------------------------------
// 🧭 CONFIG
// -----------------------------------------------------------
const REDIRECT_DELAY_MS = 800; // small wait for fade animation

// -----------------------------------------------------------
// 🧩 SAFE HELPERS
// -----------------------------------------------------------
function safeShow(id, effect = 'fade', opts = { duration: 250 }) {
  try {
    const el = $w(id);
    if (el && typeof el.show === 'function') el.show(effect, opts);
  } catch (err) {
    console.warn(`⚠️ safeShow(${id}) failed:`, err.message);
  }
}

function setText(id, text) {
  try {
    $w(id).text = text || '';
  } catch (err) {
    console.warn(`⚠️ setText(${id}) failed:`, err.message);
  }
}

// -----------------------------------------------------------
// 🧠 MAIN LOGIC
// -----------------------------------------------------------
$w.onReady(function () {
  console.log('💫 PaymentRedirecting Lightbox ready.');

  let ctx = {};
  try {
    ctx = wixWindow.lightbox.getContext() || {};
  } catch (err) {
    console.warn('⚠️ No lightbox context found:', err.message);
  }

  console.log('🌐 Redirect lightbox context received:', ctx);

  const redirectUrl = ctx?.redirectUrl;
  const gateway = ctx?.gateway || 'unknown';

  if (!redirectUrl) {
    console.error('❌ No redirectUrl found in context. Cannot continue.');
    setText('#redirectMessage', '⚠️ Something went wrong. Redirect URL not found.');
    safeShow('#redirectMessage');
    return;
  }

  // -----------------------------------------------------------
  // 🎨 UI Feedback
  // -----------------------------------------------------------
  setText('#redirectTitle', 'Redirecting to Secure Payment...');
  setText('#redirectMessage', `You’ll be redirected to ${gateway.toUpperCase()} in a moment.`);
  safeShow('#redirectTitle');
  safeShow('#redirectMessage');

  // Optional: Animate loader if you have an element with #loadingSpinner
  if ($w('#Spinner')) {
    safeShow('#Spinner');
  }

  // -----------------------------------------------------------
  // 🚀 Perform Redirect
  // -----------------------------------------------------------
  setTimeout(() => {
    console.log(`🚀 Redirecting user to: ${redirectUrl}`);
    try {
      wixLocation.to(redirectUrl);
    } catch (err) {
      console.error('❌ Redirect failed:', err.message);
      setText('#redirectMessage', '⚠️ Unable to redirect. Please click below to continue manually.');
      safeShow('#redirectMessage');

      // fallback link (if you have a button or text element for manual redirect)
      if ($w('#manualRedirectButton')) {
        $w('#manualRedirectButton').label = 'Continue to Payment';
        $w('#manualRedirectButton').onClick(() => wixLocation.to(redirectUrl));
        safeShow('#manualRedirectButton');
      }
    }
  }, REDIRECT_DELAY_MS);
});
