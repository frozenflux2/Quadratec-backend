const get_brands = require("./src/get_brand");
const get_categories = require("./src/get_categories");
const get_product_metadata = require("./src/get_product_metadata");
const get_product_details = require("./src/get_product_details");
const utils = require("./utils");

const fs = require("fs").promises;
const path = require("path");

async function countSubfolders(directory) {
  try {
    const files = await fs.readdir(directory, { withFileTypes: true }); // Read the directory contents
    let folderCount = 0;

    for (const file of files) {
      if (file.isDirectory()) {
        folderCount++; // Incrementing for each subdirectory found
        // If you also want to count folders within subfolders recursively, uncomment below lines:
        // const recursiveCount = await countSubfolders(path.join(directory, file.name));
        // folderCount += recursiveCount;
      }
    }

    console.log(`Number of subfolders in '${directory}':`, folderCount);
    return folderCount;
  } catch (error) {
    console.error("Error reading directory:", error);
    return 0;
  }
}

(async () => {
  const status = await utils.get_progress();

  if (status["brands"] < 100) await get_brands();
  if (status["categories"] < 100) await get_categories(8);
  if (status["metadata"] < 100) await get_product_metadata(16);

  if (
    status["details"] == 100 &&
    (await countSubfolders(path.join(__dirname, `./assets/data/`)))
  )
    await get_product_details(16);
  else if (status["details"] < 100) await get_product_details(16);
})();
