import wixData from 'wix-data';

export async function post_paystack(req) {
  const event = req.body.event;
  const data = req.body.data;

  switch(event) {
    case "invoice.create":
      // Save pending invoice to Transactions collection
      break;
    case "invoice.payment_failed":
      // Mark user subscription as "attention"
      break;
    case "subscription.create":
      // Save subscriptionId, joinedDate, etc.
      break;
    case "charge.success":
      // Update lastPaymentDate, lastPaymentAmount
      break;
  }

  return { status: 200 };
}
