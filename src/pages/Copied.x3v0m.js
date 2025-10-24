import wixWindow from 'wix-window';

$w.onReady(() => {
    // Automatically close after 3 seconds (3000 ms)
    setTimeout(() => {
        wixWindow.lightbox.close();
    }, 2000);
});
