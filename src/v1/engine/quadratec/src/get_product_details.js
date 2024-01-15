const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_categorieswithbrand(page, brand) {
  // Navigate to the specified URL
  await page.goto(brand["url"]);

  await sleep(1000);

  const categories = await page.evaluate(() => {
    const categoryDivs = document.querySelectorAll('li[class="parent"]');

    let categories = [];
    categoryDivs.forEach((div) => {
      const adiv = div.querySelector("a");
      categories.push({
        category: adiv.title,
        "category url": adiv.href,
      });
    });

    return categories;
  });

  const categorieswithbrand = {
    brand: brand["name"],
    "brand url": brand["url"],
    categories: categories,
  };
  return categorieswithbrand;
}

async function get_categories(numberofprocess = 4) {
  const brands = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/brands.json"), "utf8")
  );
  const chunksize = Math.ceil(brands.length / numberofprocess);

  let categories = { completed: false, data: [] };

  for (let i = 0; i < numberofprocess; i++) categories["data"].push([]);
  // check if the mata file exists
  if (fs.existsSync(path.join(__dirname, "../assets/categories.json")))
    categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../assets/categories.json"), "utf8")
    );

  const browsers = [];

  const singleProcess = async (processnumber) => {
    let finished = false;
    while (!finished) {
      // Launch a new browser session
      const browser = await puppeteer.launch({ headless: false });
      browsers.push(browser);
      // Open a new page
      const page = await browser.newPage();
      // Set the navigation timeout (in milliseconds)
      await page.setDefaultNavigationTimeout(300000); // Timeout after 30 seconds

      try {
        for (const bd of brands.slice(
          chunksize * processnumber + categories["data"][processnumber].length,
          chunksize * (processnumber + 1)
        )) {
          console.log(bd["url"]);
          const categories_with_brands = await get_categorieswithbrand(
            page,
            bd
          );
          categories["data"][processnumber].push(categories_with_brands);

          const jsonContent = JSON.stringify(categories, null, 2);
          fs.writeFileSync(
            path.join(__dirname, "../assets/categories.json"),
            jsonContent,
            "utf8",
            (err) => {
              if (err) {
                console.error("An error occurred:", err);
                return;
              }
              console.log("JSON file has been saved.");
            }
          );
        }

        finished = true;
        browser.close();
      } catch (error) {
        console.log(error);
        browser.close();
      }
    }
  };
  const processes = [];
  for (
    let processnumber = 0;
    processnumber < numberofprocess;
    processnumber++
  ) {
    processes.push(singleProcess(processnumber)); // Assuming the process numbers start from 0 and increment by 1
  }

  // Assuming browsers is an array containing your Puppeteer browser instances
  process.on("SIGINT", () => {
    Promise.all(browsers.map((browser) => browser.close()))
      .then(() => process.exit())
      .catch(() => process.exit());
  });

  process.on("SIGTERM", () => {
    Promise.all(browsers.map((browser) => browser.close()))
      .then(() => process.exit())
      .catch(() => process.exit());
  });

  await Promise.all(processes).then(() => {
    categories["completed"] = true;
    let data = [];
    for (const subcat of categories["data"]) data = data.concat(subcat);
    categories["data"] = data;

    const jsonContent = JSON.stringify(categories, null, 2);

    fs.writeFileSync(
      path.join(__dirname, "../assets/categories.json"),
      jsonContent,
      "utf8",
      (err) => {
        if (err) {
          console.error("An error occurred:", err);
          return;
        }
        console.log("JSON file has been saved.");
      }
    );
  });
}

module.exports = get_categories;
