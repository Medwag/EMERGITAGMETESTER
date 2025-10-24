import wixWindow from 'wix-window';
import wixData from 'wix-data';
import wixUsers from 'wix-users';


$w.onReady(function () {
  const data = wixWindow.lightbox.getContext();
  
  if (data && data.qrUrl) {
    $w('#qrImage').src = data.qrUrl;
  } else {
    console.warn('⚠️ No QR code URL received.');
  }

 
});