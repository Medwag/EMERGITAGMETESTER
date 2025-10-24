import wixWindow from 'wix-window';
import wixData from 'wix-data';

const COLLECTION = 'Emergency_Profiles';

let recordId;
let originalItem;

$w.onReady(async () => {
  // 1) Get the recordId passed by the dashboard
  const ctx = wixWindow.lightbox.getContext();
  recordId = ctx?.recordId;

  if (!recordId) {
    $w('#statusText').text = 'Missing recordId. Please close and retry from the dashboard.';
    $w('#btnSave').disable();
    return;
  }

  // 2) Load current record
  try {
    originalItem = await wixData.get(COLLECTION, recordId);
    if (!originalItem) throw new Error('Record not found');

    // 3) Prefill inputs
    $w('#inAidName').value       = originalItem.medicalAidDetailsName || '';
    $w('#inAidPlan').value       = originalItem.medicalAidDetailsOption || '';
    $w('#inAidNumber').value     = originalItem.medicalAidDetailsNumber || '';
    $w('#inAidDepCode').value    = originalItem.medicalAidDetailsDependantcode || '';
    $w('#inAidMainMember').value = originalItem.medAidMainMember || '';

  } catch (err) {
    console.error('Load failed:', err);
    $w('#statusText').text = 'Could not load your Medical Aid details.';
    $w('#btnSave').disable();
  }

  // 4) Wire buttons
  $w('#btnCancel').onClick(() => wixWindow.lightbox.close({ updated: false }));

  $w('#btnSave').onClick(async () => {
    // Basic validation (adjust to your needs)
    const name = ($w('#inAidName').value || '').trim();
    const number = ($w('#inAidNumber').value || '').trim();

    if (!name || !number) {
      $w('#statusText').text = 'Please fill in Provider and Member Number.';
      return;
    }

    try {
      $w('#btnSave').disable();
      if ($w('#savingSpinner')) $w('#savingSpinner').show();
      $w('#statusText').text = 'Saving...';

      // Build partial update
      const updates = {
        _id: recordId,
        medicalAidDetailsName: name,
        medicalAidDetailsOption: ($w('#inAidPlan').value || '').trim() || null,
        medicalAidDetailsNumber: number,
        medicalAidDetailsDependantcode: ($w('#inAidDepCode').value || '').trim() || null,
        medAidMainMember: ($w('#inAidMainMember').value || '').trim() || null,
        lastUpdated: new Date()
      };

      // Merge onto original to avoid wiping other fields
      const itemToSave = { ...originalItem, ...updates };

      await wixData.update(COLLECTION, itemToSave);

      // Close & tell the dashboard to refresh
      wixWindow.lightbox.close({ updated: true, section: 'MedicalAid' });

    } catch (err) {
      console.error('Save failed:', err);
      $w('#statusText').text = 'Save failed. Please try again.';
      $w('#btnSave').enable();
      if ($w('#savingSpinner')) $w('#savingSpinner').hide();
    }
  });
});
