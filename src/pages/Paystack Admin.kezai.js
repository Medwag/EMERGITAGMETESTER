import wixData from 'wix-data';

// A variable to store the dataset instance.
// Ensure '#paystackTransactionsDataset' is the correct ID of your dataset element.
const transactionDataset = $w('#dataset1');

$w.onReady(function () {
    // Filter the repeater to only show disputes on page load.
    const disputeQuery = wixData.query("paystackTransactions").eq("disputeStatus", "disputed");
    transactionDataset.setFilter(disputeQuery);
    
    // Set up event listeners for the filter and search.
    $w('#statusFilter').onChange(() => filterTransactions());
    $w('#searchInput').onKeyPress(() => filterTransactions());

    // Populate the dropdown options dynamically.
    const statuses = [
        { label: "All", value: "all" },
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Disputed", value: "disputed" }
    ];
    $w('#statusFilter').options = statuses;
});

/**
 * Filters the transaction table based on the dropdown and search input.
 */
function filterTransactions() {
    const selectedStatus = $w('#statusFilter').value;
    const searchText = $w('#searchInput').value.toLowerCase();

    // Start with a basic query on the collection.
    let filter = wixData.query("PaystackTransactions");

    // Add filter for status if not "All".
    if (selectedStatus && selectedStatus !== 'all') {
        filter = filter.eq("status", selectedStatus);
    }

    // Add filter for search text if not empty.
    if (searchText) {
        // Search by email, reference, or notes.
        filter = filter.hasSome("email", searchText)
                      .or(filter.hasSome("_id", searchText))
                      .or(filter.hasSome("notes", searchText));
    }
    
    // Apply the combined filter to the dataset.
    transactionDataset.setFilter(filter);
}