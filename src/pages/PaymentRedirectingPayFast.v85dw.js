// ✅ Payment Redirecting Lightbox — PayFast Version
// -------------------------------------------------
// - Works seamlessly with PaymentMethodSelector
// - Animated spinner (manual rotation loop)
// - Fade-in UI and safe auto-close
// - Fully Wix sandbox compatible (no `window` object)
// - Accepts context: { gateway: 'payfast', redirectUrl: '...' }

import wixWindow from 'wix-window';
import wixLocation from 'wix-location';
import { timeline } from 'wix-animations';

$w.onReady(function () {
  const context = wixWindow.lightbox.getContext() || {};
  const gateway = context.gateway
    ? context.gateway.charAt(0).toUpperCase() + context.gateway.slice(1)
    : 'Payment Gateway';
  const redirectUrl = context.redirectUrl;

  console.log(`💳 PaymentRedirectingPayFast Lightbox loaded for ${gateway}`);
  if (!redirectUrl) {
    console.error('🚫 No redirect URL provided in lightbox context.');
    $w('#redirectMessage').text = 'Payment link missing. Please try again.';
    return;
  }

  // ✅ Fade in the container safely
  const container = $w('#redirectContainer');
  if (container && typeof container.show === 'function') {
    container.show('fade', { duration: 400 });
  }

  // ✅ Set up user-facing text
  $w('#redirectMessage').text = `🔒 Connecting to ${gateway}...`;
  $w('#redirectNote').text = 'Please don’t refresh or close this window.';
  $w('#redirectNote2').text = 'Redirecting you to PayFast checkout...';

  // ✅ Spinner animation (looped safely)
  const spinner = $w('#loadingSpinner');
  if (spinner && typeof spinner.show === 'function') {
    spinner.show();
    try {
      const spin = () => {
        const anim = timeline();
        anim.add(spinner, {
          rotate: 360,
          duration: 2000,
          easing: 'easeInOutCubic'
        });
        anim.play();
      };
      spin();
      setInterval(spin, 2200);
    } catch (err) {
      console.warn('⚠️ Spinner animation skipped:', err);
    }
  } else {
    console.log('ℹ️ Spinner not found or show() unsupported.');
  }

  // ✅ Trigger redirect
  console.log('🌐 Redirecting user to PayFast:', redirectUrl);
  setTimeout(() => {
    try {
      wixLocation.to(redirectUrl);
    } catch (err) {
      console.error('⚠️ Redirect failed:', err);
      $w('#redirectMessage').text = 'Redirect failed. Please try again.';
    }
  }, 800);

  // ✅ Safety fallback: auto-close after 10 seconds
  setTimeout(() => {
    wixWindow.lightbox.close();
  }, 10000);
});
