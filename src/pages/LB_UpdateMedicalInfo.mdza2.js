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
    $w('#inBloodType').value       = originalItem.bloodTypeField || '';
    $w('#inAllergies').value       = originalItem.allergies || '';
    $w('#inMedConditions').value     = originalItem.medicalInfo || '';
   

  } catch (err) {
    console.error('Load failed:', err);
    $w('#statusText').text = 'Could not load your Medical Aid details.';
    $w('#btnSave').disable();
  }

  // 4) Wire buttons
  $w('#btnCancel').onClick(() => wixWindow.lightbox.close({ updated: false }));

  $w('#btnSave').onClick(async () => {
    // Basic validation (adjust to your needs)
    const name = ($w('#inBloodType').value || '').trim();
    const number = ($w('#inAllergies').value || '').trim();

    if (!name || !number) {
      $w('#statusText').text = 'Please fill in Your Blood Types and Allergies.';
      return;
    }

    try {
      $w('#btnSave').disable();
      if ($w('#savingSpinner')) $w('#savingSpinner').show();
      $w('#statusText').text = 'Saving...';

      // Build partial update
      const updates = {
        _id: recordId,
        bloodTypeField: name,
        allergies: ($w('#inAllergies').value || '').trim() || null,
        medicalInfo: number,
       
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
