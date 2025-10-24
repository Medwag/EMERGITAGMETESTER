// ✅ Payment Redirect Page — Safe Version for Wix Studio
import wixLocation from 'wix-location';

// 🧩 Safe Base64 helpers
function encodeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (err) {
    console.error('⚠️ encodeBase64 failed:', err);
    return '';
  }
}

function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (err) {
    console.error('⚠️ decodeBase64 failed:', err);
    return '';
  }
}

$w.onReady(() => {
  const { query } = wixLocation;
  const gateway = query.gateway || 'Gateway';
  const redirectUrl = decodeBase64(query.url || '');

  console.log('🌐 [RedirectPage] Gateway:', gateway);
  console.log('🌐 [RedirectPage] Decoded URL:', redirectUrl);

  if (!redirectUrl) {
    if ($w('#redirectMessage')) $w('#redirectMessage').text = '⚠️ Missing or invalid payment link.';
    return;
  }

  if ($w('#redirectContainer')) $w('#redirectContainer').show('fade', { duration: 250 });
  if ($w('#redirectMessage')) $w('#redirectMessage').text = `🔒 Connecting to ${gateway}...`;

  // fallback manual button (optional)
  if ($w('#manualRedirectButton')) {
    $w('#manualRedirectButton').onClick(() => {
      console.log('🖱 Manual redirect:', redirectUrl);
      wixLocation.to(redirectUrl);
    });
  }

  setTimeout(() => {
    try {
      console.log(`➡️ Redirecting to ${gateway}:`, redirectUrl);
      wixLocation.to(redirectUrl);
    } catch (err) {
      console.error('💥 Redirect failed:', err);
      if ($w('#redirectMessage')) $w('#redirectMessage').text = '⚠️ Redirect failed. Please click below.';
      if ($w('#manualRedirectButton')) $w('#manualRedirectButton').show();
    }
  }, 1000);
});
