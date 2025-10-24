// ✅ PaymentMethodSelector Lightbox (Wix Studio Safe Version)
// -------------------------------------------------------
// - Works in Wix Studio (no window object)
// - Handles Paystack + PayFast
// - Reliable redirect + data handoff to parent
// - Smooth fade-out close transition
// -------------------------------------------------------

// ✅ Safe backend imports (aliased to avoid name collisions)
import {
  getPaymentMethods as getPaymentMethodsBackend,
  createSignupPaymentWithGateway as createSignupPaymentWithGatewayBackend,
  createSubscriptionPaymentWithGateway as createSubscriptionPaymentWithGatewayBackend,
  getRecommendedPaymentMethod as getRecommendedPaymentMethodBackend,
} from 'backend/core/dual-payment-gateway-simple.jsw';

import wixLocation from 'wix-location';
import wixUsers from 'wix-users';
import wixWindow from 'wix-window';

// -------------------------------------------------------------
// 🎨 CONFIG / STYLES
// -------------------------------------------------------------
const BRAND = {
  base: '#00C3F7',
  baseDark: '#009CC6',
  disabled: '#BDEAF8',
};
const FADE_IN = { duration: 250 };
const FADE_OUT = { duration: 120 };

// -------------------------------------------------------------
// 🧠 STATE
// -------------------------------------------------------------
let selectedGateway = null;
let paymentMethods = [];
let isSubscription = false;
let lightboxContext = {};

// -------------------------------------------------------------
// 🧩 SAFE HELPERS
// -------------------------------------------------------------
function safeShow(id, effect = 'fade', opts = FADE_IN) {
  try {
    const el = $w(id);
    if (el && typeof el.show === 'function') el.show(effect, opts);
  } catch (err) {
    console.warn(`⚠️ safeShow(${id}) failed:`, err.message);
  }
}

function safeHide(id, effect = 'fade', opts = FADE_OUT) {
  try {
    const el = $w(id);
    if (el && typeof el.hide === 'function') el.hide(effect, opts);
  } catch (err) {
    console.warn(`⚠️ safeHide(${id}) failed:`, err.message);
  }
}

function setText(id, text) {
  try {
    $w(id).text = text || '';
  } catch (err) {
    console.warn(`⚠️ setText(${id}) failed:`, err.message);
  }
}

function setBg(id, color) {
  try {
    $w(id).style.backgroundColor = color;
  } catch (err) {
    console.warn(`⚠️ setBg(${id}) failed:`, err.message);
  }
}

function enable(id, yes = true) {
  try {
    yes ? $w(id).enable() : $w(id).disable();
  } catch (err) {
    console.warn(`⚠️ enable(${id}) failed:`, err.message);
  }
}

function exists(id) {
  try {
    return !!$w(id);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// 🧭 SAFE LIGHTBOX CLOSE (Smooth Fade-Out + Delay)
// -------------------------------------------------------------
async function safeCloseLightbox(payload) {
  console.log('🚪 Attempting smooth close with payload:', payload);
  try {
    const safePayload = JSON.parse(JSON.stringify(payload));

    try {
      if ($w('#container')) {
        await $w('#container').hide('fade', { duration: 1000 });
      } else if ($w('#overlayBox')) {
        await $w('#overlayBox').hide('fade', { duration: 500 });
      }
    } catch (fadeErr) {
      console.warn('⚠️ Fade-out skipped:', fadeErr.message);
    }

    await new Promise((r) => setTimeout(r, 500));

    if (wixWindow.lightbox && typeof wixWindow.lightbox.close === 'function') {
      wixWindow.lightbox.close(safePayload);
    } else {
      console.warn('⚠️ safeCloseLightbox called outside of Lightbox context.');
    }
  } catch (err) {
    console.error('❌ safeCloseLightbox error:', err.message);
  }
}

// -------------------------------------------------------------
// 💳 UI LOGIC
// -------------------------------------------------------------
function styleGatewayButtons() {
  setBg('#paystackButton', BRAND.base);
  setBg('#payfastButton', BRAND.base);

  if (selectedGateway === 'paystack') setBg('#paystackButton', BRAND.baseDark);
  if (selectedGateway === 'payfast') setBg('#payfastButton', BRAND.baseDark);

  if (selectedGateway) {
    setBg('#continueButton', BRAND.baseDark);
    enable('#continueButton', true);
  } else {
    setBg('#continueButton', BRAND.disabled);
    enable('#continueButton', false);
  }
}

function fillSubscriberDetails(ctx, userEmail) {
  const name = ctx?.fullName || ctx?.name || '';
  const email = ctx?.email || ctx?.emailAddress || userEmail || '';
  const phone = ctx?.signUpPhoneNumber || ctx?.phone || '';
  const home =
    typeof ctx?.homeAddress === 'object'
      ? ctx.homeAddress.formatted || ''
      : ctx?.homeAddress || '';
  const delivery =
    typeof ctx?.deliveryAddress === 'object'
      ? ctx.deliveryAddress.formatted || ''
      : ctx?.deliveryAddress || '';

  setText('#SubscriberName', name || 'Name not provided');
  setText('#SubscriberEmail', email || '—');
  setText('#SubscriberPhoneNumber', phone || '—');
  setText('#SubscriberHomeAddress', home || '—');
  setText('#SubscriberDeliveryAddress', delivery || '—');

  safeShow('#SubscriberDetails');
  console.log('✅ Subscriber details filled');
}

function applySelectionUI(method) {
  const line = `Selected: ${method.name.toUpperCase()} - ${method.description}`;
  setText('#selectedMethodText', line);
  safeHide('#SelectedBox');
  setTimeout(() => {
    setText(
      '#methodName',
      `${method.name} selected.\nTo complete your signup, please click Continue below to pay securely with ${method.name}.`
    );
    safeShow('#SelectedBox');
  }, 200);
  safeShow('#Providers');
  styleGatewayButtons();
  console.log('✅ Selection applied for', method.name);
}

function selectGateway(gatewayId) {
  const method = paymentMethods.find((m) => m.id === gatewayId);
  if (!method) return;
  selectedGateway = gatewayId;
  applySelectionUI(method);
}

// -------------------------------------------------------------
// 🚀 CONTINUE HANDLER
// -------------------------------------------------------------
async function handleContinue() {
  if (!selectedGateway) {
    showError('Please select a payment method.');
    return;
  }

  try {
    if (exists('#overlayBox')) {
      safeShow('#overlayBox');
      setText('#loadingText', '🔄 Preparing your payment session...');
    }

    $w('#continueButton').label = '⏳ Creating payment...';
    enable('#continueButton', false);

    const user = wixUsers.currentUser;
    const userEmail = await user.getEmail();
    const userId = lightboxContext.userId || user.id;
    const email = lightboxContext.email || userEmail;

    let result;
    if (isSubscription) {
      const planName = lightboxContext.planName;
      const isAnnual = !!lightboxContext.isAnnual;
      result = await createSubscriptionPaymentWithGatewayBackend(
        userId,
        planName,
        isAnnual,
        selectedGateway
      );
    } else {
      result = await createSignupPaymentWithGatewayBackend(userId, selectedGateway, email);
    }

    if (result?.success && result?.redirectUrl) {
      console.log('✅ Payment created successfully:', result.redirectUrl);

      const payload = {
        paymentInitiated: true,
        gateway: selectedGateway,
        redirectUrl: result.redirectUrl,
      };

      setTimeout(() => {
        wixWindow
          .openLightbox('PaymentRedirecting', payload)
          .catch(() => {
            console.warn('⚠️ Lightbox open fallback — redirecting manually.');
            wixLocation.to(result.redirectUrl);
          });
      }, 200);

      await safeCloseLightbox(payload);
    } else {
      console.error('❌ Payment gateway result invalid:', result);
      showError(result?.error || 'Payment could not be started. Please try again.');
    }
  } catch (err) {
    console.error('💥 Payment error:', err);
    showError(`Payment error: ${err.message}`);
  } finally {
    if (exists('#overlayBox')) safeHide('#overlayBox');
    $w('#continueButton').label = 'Continue';
    enable('#continueButton', true);
  }
}

// -------------------------------------------------------------
// ⚠️ ERROR HANDLER
// -------------------------------------------------------------
function showError(message) {
  console.error('❌', message);
  setText('#errorText', `❌ ${message}`);
  safeShow('#errorText');
}

// -------------------------------------------------------------
// 🏁 ON READY
// -------------------------------------------------------------
$w.onReady(async () => {
  console.log('💳 PaymentMethodSelector Lightbox Ready');

  try {
    lightboxContext = wixWindow.lightbox.getContext() || {};
  } catch {
    lightboxContext = {};
  }

  isSubscription = !!(lightboxContext.planName || lightboxContext.isAnnual);

  try {
    $w('#cancelButton').onClick(() => wixWindow.lightbox.close());
  } catch {
    console.warn('CancelButton binding skipped.');
  }

  const user = wixUsers.currentUser;
  if (!user || !user.loggedIn) {
    showError('Please log in to continue with payment.');
    return;
  }

  try {
    const email = await user.getEmail();
    fillSubscriberDetails(lightboxContext, email);
  } catch {
    fillSubscriberDetails(lightboxContext, '');
  }

  try {
    paymentMethods = await getPaymentMethodsBackend();
  } catch (err) {
    console.warn('⚠️ Fallback payment methods used:', err.message);
    paymentMethods = [
      { id: 'paystack', name: 'Paystack', description: 'Pay securely with Paystack' },
      { id: 'payfast', name: 'PayFast', description: 'Pay securely with PayFast' },
    ];
  }

  setText('#headerText', '💳 Choose Your Payment Method');
  setText('#paymentTitle', 'Choose Your Payment Method');
  setText('#paymentInstruction', 'Please select a payment provider to continue.');
  setText('#amountText', 'Signup Fee: R149.00');

  try {
    $w('#paystackButton').label = 'Pay Using Paystack';
    $w('#paystackButton').onClick(() => selectGateway('paystack'));
  } catch {}
  try {
    $w('#payfastButton').label = 'Pay Using PayFast';
    $w('#payfastButton').onClick(() => selectGateway('payfast'));
  } catch {}
  try {
    $w('#continueButton').onClick(handleContinue);
  } catch {}

  let defaultGw = 'paystack';
  try {
    defaultGw = await getRecommendedPaymentMethodBackend();
  } catch (err) {
    console.warn('Default gateway fallback:', err.message);
  }

  selectGateway(defaultGw);
  console.log('✅ PaymentMethodSelector fully loaded.');
});
