// Pages/Client Management.awu0v.js (or your Admin Dashboard page)

import wixData from 'wix-data';
import wixLocation from 'wix-location';
import wixWindow from 'wix-window';
import { cancelPayfastSubscription } from 'backend/payfastActions.jsw';
import wixUsers from 'wix-users';
import { getSubscriptionDetails } from 'backend/payfast';

const SUBSCRIBERS_COLLECTION = 'payfastSubscribers';
const PAGE_SIZE = 10;

let currentPage = 0;
let totalCount = 0;

let currentSubscriberToCancel = null;
let currentPayfastSubIdToCancel = null;

$w.onReady(function () {
    $w("#loadingIndicator").hide();
    $w("#noResultsText").hide();
    $w("#errorMessageText").hide();
    $w("#successMessageText").hide();
    $w("#prevButton").hide();
    $w("#nextButton").hide();
    $w("#pageNumberText").hide();

    performSecurityCheck();

    async function performSecurityCheck() {
        console.log("--- Starting Security Check ---");

        const currentUser = wixUsers.currentUser;
const userId = currentUser.id;

        if (!currentUser || !currentUser.loggedIn) {
            console.warn("User not logged in. Redirecting to home.");
            wixLocation.to('/');
            return;
        }

        try {
            const roles = await currentUser.getRoles();
            const isAdmin = roles.some(role => role.name === 'Admin');

            if (!isAdmin) {
                console.warn("Unauthorized access attempt. User is not an Admin. Redirecting.");
                wixLocation.to('/my-account');
            } else {
                console.log("Admin user logged in. Loading dashboard data.");
                loadSubscribers();
                updatePaginationButtons();
            }
        } catch (error) {
            const errorMessage = error?.message || 'An unknown error occurred during role check.';
            console.error("Error checking user roles:", errorMessage, error);
            wixLocation.to('/my-account');
        }

        console.log("--- End Security Check ---");
    }
	
});

async function loadSubscribers() {
    $w("#loadingIndicator").show();
    $w("#subscribersRepeater").hide();
    $w("#noResultsText").hide();
    $w("#errorMessageText").hide();
    $w("#successMessageText").hide();

    try {
        const results = await wixData.query(SUBSCRIBERS_COLLECTION)
            .limit(PAGE_SIZE)
            .skip(currentPage * PAGE_SIZE)
            .descending('lastPaymentDate')
            .find();

        totalCount = results.totalCount;

        if (results.items.length > 0) {
    const enrichedItems = await Promise.all(results.items.map(async (item) => {
        let payfastData = null;

        if (item.subscriptionToken) {
            payfastData = await getSubscriptionDetails(item.subscriptionToken);
        }

        return {
            ...item,
            _id: item._id,
            lastPaymentDateFormatted: item.lastPaymentDate ? item.lastPaymentDate.toLocaleDateString('en-ZA') : 'N/A',
            nextPaymentDateFormatted: item.nextPaymentDate ? item.nextPaymentDate.toLocaleDateString('en-ZA') : 'N/A',
            signupDateFormatted: item.signupDate ? item.signupDate.toLocaleDateString('en-ZA') : 'N/A',
            lastPaymentAmountFormatted: item.lastPaymentAmount ? `R${item.lastPaymentAmount.toFixed(2)}` : 'R0.00',
            signupPaidText: item.signupPaid ? 'Yes' : 'No',
            nextAmountDisplay: payfastData?.amount ? `R${Number(payfastData.amount).toFixed(2)}` : 'N/A',
            totalRevenueDisplay: payfastData?.cycles
                ? `R${(Number(payfastData.cycles) * Number(payfastData.amount)).toFixed(2)}`
                : 'N/A',
            status: payfastData?.status || item.status || 'UNKNOWN'
        };
    }));

    $w("#subscribersRepeater").data = enrichedItems;

    $w("#subscribersRepeater").onItemReady(($item, itemData) => {
        $item("#Subscriber").text = itemData.name || itemData.email || 'N/A';
        $item("#Plan").text = itemData.subscriptionPlan || 'N/A';
        $item("#PaidSignUp").text = itemData.signupPaidText;
        $item("#signUpdate").text = itemData.signupDateFormatted;
        $item("#lastPaidAmount").text = itemData.lastPaymentAmountFormatted;
        $item("#lastPaymentDate").text = itemData.lastPaymentDateFormatted;
        $item("#NextPaymentDate").text = itemData.nextPaymentDateFormatted;
        $item("#nextAmount").text = itemData.nextAmountDisplay;
        $item("#totalRevenue").text = itemData.totalRevenueDisplay;

        if ($item("#memberStatusText")) {
            if (itemData.status === 'COMPLETE' || itemData.status === 'ACTIVE') {
                $item("#memberStatusText").style.color = "green";
            } else if (itemData.status === 'CANCELLED' || itemData.status === 'FAILED') {
                $item("#memberStatusText").style.color = "red";
            } else if (itemData.status === 'PENDING') {
                $item("#memberStatusText").style.color = "orange";
            }
            $item("#memberStatusText").text = itemData.status;
        }

        $item("#cancelSubscription").onClick(() => {
            showConfirmationModal(itemData._id, itemData.payfastSubscriptionId, itemData.name || itemData.email);
        });
    });

    $w("#subscribersRepeater").show();
    console.log("Subscribers loaded with PayFast data. Total:", totalCount, "Current Page:", currentPage);
}
 else {
            $w("#subscribersRepeater").data = [];
            $w("#noResultsText").show();
            console.log("No subscribers found.");
        }

    } catch (error) {
        const errorMessage = error?.message || 'An unknown error occurred loading subscribers.';
        console.error("Error loading subscribers:", errorMessage, error);
        $w("#errorMessageText").text = "Failed to load member data. Please try again. " + errorMessage;
        $w("#errorMessageText").show();
    } finally {
        $w("#loadingIndicator").hide();
        updatePaginationButtons();
        $w("#pageNumberText").text = `Page ${currentPage + 1} of ${Math.ceil(totalCount / PAGE_SIZE)}`;
        $w("#pageNumberText").show();
    }
}

function updatePaginationButtons() {
    if (totalCount > PAGE_SIZE) {
        $w("#prevButton").show();
        $w("#nextButton").show();

        if (currentPage > 0) {
            $w("#prevButton").enable();
        } else {
            $w("#prevButton").disable();
        }

        if ((currentPage + 1) * PAGE_SIZE < totalCount) {
            $w("#nextButton").enable();
        } else {
            $w("#nextButton").disable();
        }
    } else {
        $w("#prevButton").hide();
        $w("#nextButton").hide();
    }
}

export function prevButton_onClick() {
    if (currentPage > 0) {
        currentPage--;
        loadSubscribers();
    }
}

export function nextButton_onClick() {
    if ((currentPage + 1) * PAGE_SIZE < totalCount) {
        currentPage++;
        loadSubscribers();
    }
}

function showConfirmationModal(memberId, payfastSubId, memberName) {
    currentSubscriberToCancel = memberId;
    currentPayfastSubIdToCancel = payfastSubId;

    wixWindow.openLightbox("ConfirmationModal", {
        message: `Are you sure you want to cancel the subscription for ${memberName}? This action cannot be undone.`,
        title: "Confirm Cancellation"
    }).then(result => {
        if (result === "yes") {
            console.log("User confirmed cancellation.");
            cancelSubscription(currentSubscriberToCancel, currentPayfastSubIdToCancel);
        } else {
            console.log("User cancelled cancellation.");
        }
        currentSubscriberToCancel = null;
        currentPayfastSubIdToCancel = null;
    }).catch(error => {
        const errorMessage = error?.message || 'An unknown error occurred opening confirmation modal.';
        console.error("Error opening confirmation modal:", errorMessage, error);
    });
}

async function cancelSubscription(memberId, payfastSubId) {
    if (!payfastSubId) {
        console.error("Cannot cancel subscription: PayFast Subscription ID is missing.");
        $w("#errorMessageText").text = "Cannot cancel: PayFast Subscription ID missing.";
        $w("#errorMessageText").show();
        return;
    }

    $w("#loadingIndicator").show();
    $w("#errorMessageText").hide();
    $w("#successMessageText").hide();

    try {
        const result = await cancelPayfastSubscription(payfastSubId);
        if (result.success) {
            console.log("Subscription cancelled successfully:", result.message);
            loadSubscribers();
            $w("#successMessageText").text = `Subscription for ${result.memberName || 'member'} cancelled successfully.`;
            $w("#successMessageText").show();
            setTimeout(() => $w("#successMessageText").hide(), 5000);
        } else {
            const errorMessage = result?.message || 'An unknown error occurred during cancellation.';
            console.error("Failed to cancel subscription:", errorMessage);
            $w("#errorMessageText").text = `Failed to cancel subscription: ${errorMessage}`;
            $w("#errorMessageText").show();
        }
    } catch (error) {
        const errorMessage = error?.message || 'An unknown error occurred calling backend to cancel subscription.';
        console.error("Error calling backend to cancel subscription:", errorMessage, error);
        $w("#errorMessageText").text = `An error occurred during cancellation: ${errorMessage}`;
        $w("#errorMessageText").show();
    } finally {
        $w("#loadingIndicator").hide();
    }
}
