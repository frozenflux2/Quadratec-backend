const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_brands() {
  await sleep(1000);
  exec("killall chrome");
  await sleep(1000);
  exec(
    '/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222'
  );
  await sleep(1000);

  const browserURL = "http://127.0.0.1:9222";

  const browser = await puppeteer.connect({ browserURL });
  const page = (await browser.pages())[0];

  await page.goto("https://www.polyperformance.com/brands", { timeout: 60000 });

  await sleep(3000);

  const brands = await page.evaluate(() => {
    let brands = [];
    const brandDivs = document.querySelectorAll(
      'li[class="ambrands-brand-item "]'
    );
    if (brandDivs) {
      brandDivs.forEach((div) => {
        const brandname = div.textContent.trim();
        const brandurl = div.querySelector("a").href;

        brands.push({
          name: brandname,
          url: brandurl,
        });
      });
    }
    return brands;
  });
  exec("killall chrome");
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
}

module.exports = get_brands;
