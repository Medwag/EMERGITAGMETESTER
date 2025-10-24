import wixData from 'wix-data';

$w.onReady(async () => {
  // Show dropdown and repeater
  $w("#billingCycleDropdown").show();
  $w("#planRepeater").show();
  $w("#discountBadgeimage").hide(); // This stays hidden unless shown per item

  // Load default cycle
  loadPlans("Monthly");

  // Handle dropdown change
  $w("#billingCycleDropdown").onChange(() => {
    const selected = $w("#billingCycleDropdown").value;
    $w("#planRepeater").data = []; // Clear old data
    loadPlans(selected);
  });
});

async function loadPlans(cycle) {
  const results = await wixData.query("PlanOptions")
    .ascending("sortOrder")
    .find();

  $w("#planRepeater").data = results.items;

  $w("#planRepeater").onItemReady(($item, itemData) => {
    const getZar = (v) => (typeof v === 'number' ? v : Number(v || 0));
    const getPrice = (plan, isAnnual) => {
      const mp = getZar(plan.monthlyPrice);
      const ap = getZar(plan.annualPrice);
      if (mp || ap) return isAnnual ? ap : mp;
      const pmp = getZar(plan.priceMonthly);
      const pap = getZar(plan.priceAnnual);
      if (pmp || pap) return isAnnual ? pap : pmp;
      const amp = getZar(plan.amountMonthly) / 100;
      const aap = getZar(plan.amountAnnual) / 100;
      if (amp || aap) return isAnnual ? aap : amp;
      return 0;
    };
    const price = getPrice(itemData, cycle === "Annual");
    const otherCyclePrice = getPrice(itemData, cycle !== "Annual");
    const other = cycle === "Annual" ? (otherCyclePrice * 12) : (otherCyclePrice / 12);
    const savings = other ? Math.round(((other - price) / other) * 100) : 0;

    const name = itemData.planTier || itemData.planName || itemData.tierName || itemData.title || "Plan";
    $item("#planName").text = name;
    $item("#planDescription").text = itemData.description || "";
    $item("#planPrice").text = `R${price} / ${cycle}`;
    $item("#planImage").src = itemData.productImage;
    $item("#discountBadgeimage").src = itemData.image2;

    if (cycle === "Annual" && savings >= 5) {
      $item("#discountBadge").text = `Save ${savings}%`;
      $item("#discountBadge").show();
      $item("#discountBadgeimage").show();
    } else {
      $item("#discountBadge").hide();
      $item("#discountBadgeimage").hide();
    }
  });
}
