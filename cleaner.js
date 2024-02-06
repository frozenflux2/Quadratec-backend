const fs = require('fs');
const path = require('path');
const os = require('os');

function removeDirectories() {
    const directoryPath = os.tmpdir(); // Getting system temp directory

    fs.readdirSync(directoryPath).forEach((file) => {
        try {
            let fullPath = path.join(directoryPath, file);
            if (fs.lstatSync(fullPath).isDirectory() && file.startsWith('puppeteer')) {
                fs.rmSync(fullPath, { recursive: true }); // Use the rmdirSync with option { recursive: true }
                console.log(`Successfully deleted directory ${fullPath}`);
            }
        } catch (error) {}
    });

    setTimeout(() => {
        removeDirectories();
    }, 60 * 60 * 1000);
}

removeDirectories();