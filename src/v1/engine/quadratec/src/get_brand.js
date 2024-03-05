const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_brands() {
  console.log("get brands");
  // Launch a new browser session
  const browser = await puppeteer.launch({ headless: false });
  console.log("browser created");

  // Open a new page
  const page = await browser.newPage();

  // Set the navigation timeout (in milliseconds)
  await page.setDefaultNavigationTimeout(300000); // Timeout after 30 seconds

  // Navigate to the specified URL
  await page.goto("https://www.quadratec.com/shop-by-brand");

  await sleep(1000);

  const brands = await page.evaluate(() => {
    const brandDivs = document.querySelectorAll('div[class="brand-icon"]');

    let brands = [];
    brandDivs.forEach((div) => {
      const adiv = div.querySelector("a");
      brands.push({
        name: adiv.title,
        url: adiv.href,
      });
    });

    return brands;
  });
  const jsonContent = JSON.stringify(brands, null, 2);
  fs.writeFileSync(
    path.join(__dirname, "../assets/brands.json"),
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

  browser.close();
}

// (async () => {
//   await get_brands();
// })();

module.exports = get_brands;
