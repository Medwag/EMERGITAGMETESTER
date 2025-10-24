import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { currentMember } from 'wix-members';

$w.onReady(async () => {
  // ---------- Paystack Confirmation Check ----------
  const ref = wixLocation.query.reference;
  const user = await currentMember.getMember();

  if (!user) {
    $w("#membershipText").text = "Please log in.";
    $w("#planMessage").text = "Please log in to view your plan.";
    $w("#planMessage").expand();
    return;
  }

  const userId = user._id;

  if (ref) {
    const tx = await wixData.get("PaystackTransactions", ref).catch(() => null);

    if (tx && tx.userId === userId) {
      if (tx.status === "success" || tx.status === "completed") {
        $w("#planMessage").text = `✅ Your ${tx.planName} subscription is now active!`;
      } else {
        $w("#planMessage").text = `⚠️ Transaction received but status is "${tx.status}". Please check back soon.`;
      }
    } else {
      $w("#planMessage").text = `⚠️ Payment is processing. Please check again in 1–2 minutes.`;
    }

    $w("#planMessage").expand();
  }

  // ---------- YOUR EXISTING CODE BELOW ----------
  $w("#Subscriber").collapse();
  $w("#price").collapse();
  $w("#details").collapse();
  $w("#publicProfileBtn").hide();
  $w("#dashboardBtn").hide();
  $w("#subscribeBtn").collapse();
  $w("#goldMessage").hide();
  $w("#upgradeSection").collapse();
  $w("#downgradeSection").collapse();
  $w("#upgradeSelect").hide();
  $w("#downgradeSelect").hide();
  $w("#upgradeDowngradeChoice").hide();
  $w("#planDetailsBox").collapse();
  $w("#confirmUpgradeBtn").hide();
  $w("#confirmDowngradeBtn").hide();

  const email = user.loginEmail;
  const result = await wixData.query("Emergency_Profiles").eq("_owner", userId).find();

  if (result.items.length > 0) {
    const profile = result.items[0];
    const plan = profile.membershipTier;
    const publicViewId = profile.publicViewId;
    const siteBaseUrl = "https://www.emergitag.me";
    const publicURL = `${siteBaseUrl}/emergencyview/${publicViewId}`;

    $w("#membershipText").text = plan ? `Your Current Plan: ${plan}` : "No Plan Selected";

    if (plan) {
      await $w("#dataset2").setFilter(wixData.filter().eq("tierName", plan));
      $w("#price").expand();
      $w("#details").expand();
      $w("#publicProfileBtn").show();
      $w("#dashboardBtn").show();
      $w("#Subscriber").expand();

      if (plan === "Gold") {
        $w("#goldMessage").text = "You are on our Gold Plan. The Gold plan is our highest plan.";
        $w("#goldMessage").show();
      }

      const allPlans = ["Bronze", "Silver", "Gold"];
      const currentIndex = allPlans.indexOf(plan);
      const upgradeOptions = allPlans.slice(currentIndex + 1).map(p => ({ label: p, value: p }));
      const downgradeOptions = allPlans.slice(0, currentIndex).map(p => ({ label: p, value: p }));

      $w("#upgradeDowngradeChoice").options = [
        { label: "Upgrade", value: "upgrade" },
        { label: "Downgrade", value: "downgrade" }
      ];
      $w("#upgradeDowngradeChoice").value = "";
      $w("#upgradeDowngradeChoice").show();

      $w("#upgradeDowngradeChoice").onChange(() => {
        const choice = $w("#upgradeDowngradeChoice").value;

        $w("#planDetailsBox").collapse();
        $w("#confirmUpgradeBtn").hide();
        $w("#confirmDowngradeBtn").hide();
        $w("#upgradeSection").collapse();
        $w("#downgradeSection").collapse();
        $w("#upgradeSelect").hide();
        $w("#downgradeSelect").hide();

        if (choice === "upgrade") {
          if (upgradeOptions.length > 0) {
            $w("#upgradeSelect").options = upgradeOptions;
            $w("#upgradeSelect").enable();
          } else {
            $w("#upgradeSelect").options = [{ label: "No upgrade options available", value: "" }];
            $w("#upgradeSelect").disable();
          }
          $w("#upgradeSection").expand();
          $w("#upgradeSelect").show();
        } else if (choice === "downgrade") {
          if (downgradeOptions.length > 0) {
            $w("#downgradeSelect").options = downgradeOptions;
            $w("#downgradeSelect").enable();
          } else {
            $w("#downgradeSelect").options = [{ label: "No downgrade options available", value: "" }];
            $w("#downgradeSelect").disable();
          }
          $w("#downgradeSection").expand();
          $w("#downgradeSelect").show();
        }
      });

      $w("#upgradeSelect").onChange(() => {
        const selected = $w("#upgradeSelect").value;
        if (selected) {
          showPlanDetails(selected);
          $w("#confirmUpgradeBtn").show();
          $w("#confirmDowngradeBtn").hide();
        }
      });

      $w("#downgradeSelect").onChange(() => {
        const selected = $w("#downgradeSelect").value;
        if (selected) {
          showPlanDetails(selected);
          $w("#confirmDowngradeBtn").show();
          $w("#confirmUpgradeBtn").hide();
        }
      });

      $w("#confirmUpgradeBtn").onClick(() => {
        const selected = $w("#upgradeSelect").value;
        if (selected) {
          const metadata = { userId, membershipTier: selected, email };
          const redirectUrl = `https://paystack.com/pay/YOUR_UPGRADE_LINK?metadata=${encodeURIComponent(JSON.stringify(metadata))}`;
          wixLocation.to(redirectUrl);
        }
      });

      $w("#confirmDowngradeBtn").onClick(() => {
        const selected = $w("#downgradeSelect").value;
        if (selected) {
          const metadata = { userId, membershipTier: selected, email };
          const redirectUrl = `https://paystack.com/pay/YOUR_DOWNGRADE_LINK?metadata=${encodeURIComponent(JSON.stringify(metadata))}`;
          wixLocation.to(redirectUrl);
        }
      });

      $w("#publicProfileBtn").onClick(() => {
        wixLocation.to(publicURL);
      });

      $w("#dashboardBtn").onClick(() => {
        wixLocation.to("/client-dashboard");
      });

    } else {
      $w("#planMessage").text = "Please subscribe to a plan.";
      $w("#planMessage").expand();
      $w("#subscribeBtn").expand();
    }

  } else {
    $w("#membershipText").text = "No profile found.";
    $w("#planMessage").text = "Please subscribe to a plan.";
    $w("#planMessage").expand();
    $w("#subscribeBtn").expand();
  }
});

function showPlanDetails(plan) {
  wixData.query("PlanOptions")
    .eq("tierName", plan)
    .find()
    .then(results => {
      if (results.items.length > 0) {
        const planData = results.items[0];
        $w("#planNameText").text = planData.tierName || "Plan";
        $w("#planDescriptionText").text = planData.description || "No description available.";
        $w("#planPriceText").text = `${planData.price}` || "N/A";
        $w("#planDetailsBox").expand();
      } else {
        $w("#planDetailsBox").collapse();
      }
    })
    .catch(err => {
      console.error("❌ Error fetching plan details:", err);
    });
}
