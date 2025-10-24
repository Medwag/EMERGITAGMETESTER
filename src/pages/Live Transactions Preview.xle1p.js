import wixWindow from 'wix-window';
import wixLocation from 'wix-location';


let transactions = [];

$w.onReady(function () {
    const context = wixWindow.lightbox.getContext();
    transactions = context?.results || [];

    if (!transactions || transactions.length === 0) {
        $w('#loadingText').hide();
        $w('#emptyText').text = 'No live transactions found.';
        $w('#emptyText').show();
        $w('#exportBtn').hide();
        return;
    }

    $w('#loadingText').hide();
    $w('#exportBtn').show();

    // Bind repeater
    $w('#resultsRepeater').data = transactions;

    $w('#resultsRepeater').onItemReady(($item, itemData) => {
        $item('#gatewayText').text = itemData.gateway;
        $item('#emailText').text = itemData.email;
        $item('#amountText').text = `R ${Number(itemData.amount).toFixed(2)}`;
        $item('#statusText').text = itemData.status;
        $item('#dateText').text = formatDate(itemData.date);
        $item('#planText').text = itemData.plan || '-';

        // Color-code status
        if (itemData.status?.toLowerCase().includes('success')) {
            $item('#statusText').style.color = '#2e7d32';
        } else if (itemData.status?.toLowerCase().includes('fail')) {
            $item('#statusText').style.color = '#b71c1c';
        } else {
            $item('#statusText').style.color = '#555';
        }
    });

    // Buttons
    $w('#closeBtn').onClick(() => wixWindow.lightbox.close());
    $w('#exportBtn').onClick(() => exportToCSV(transactions));
});

function formatDate(d) {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleString();
    } catch {
        return d;
    }
}

/**
 * Creates and downloads a CSV file from the results
 */
function exportToCSV(data) {
    if (!data || data.length === 0) {
        wixWindow.openLightbox('InfoBox', { message: 'No data available to export.' });
        return;
    }

    // Define CSV headers
    const headers = [
        'Gateway',
        'Email',
        'Amount (R)',
        'Status',
        'Date',
        'Plan / Subscription',
        'Reference'
    ];

    // Build rows
    const rows = data.map(item => [
        safe(item.gateway),
        safe(item.email),
        safe(item.amount),
        safe(item.status),
        formatDate(item.date),
        safe(item.plan),
        safe(item.reference)
    ]);

    // Combine into CSV string
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Convert to Blob URL
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

    // Open in new tab to trigger download
wixWindow.openLightbox("InfoBox", { 
    message: "✅ Export prepared. Your CSV will open in a new tab."
});
wixLocation.to(encodedUri);
}

function safe(value) {
    return String(value || '').replace(/,/g, ''); // avoid comma breaks
}
