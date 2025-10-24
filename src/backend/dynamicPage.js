import { sendSMSAlert } from 'backend/notify.jsw';

$w.onReady(function () {
  const publicViewId = $w('#dynamicDataset').getCurrentItem().publicViewId;

  // Trigger alert to admin
  sendSMSAlert(publicViewId);
});
