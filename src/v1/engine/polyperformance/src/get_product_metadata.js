const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_metadata(page, brand) {
  await page.goto(`${brand["url"]}?product_list_limit=all`, { timeout: 60000 });

  await sleep(3000);

  let metadata = {
    "brand name": brand["name"],
    "brand url": brand["url"],
  };
  const products = await page.evaluate(() => {
    let products = [];
    const brandDivs = document.querySelectorAll(
      'strong[class="product name product-item-name"]'
    );
    if (brandDivs) {
      brandDivs.forEach((div) => {
        const productname = div.textContent.trim();
        const producturl = div.querySelector("a").href;

        products.push({
          name: productname,
          url: producturl,
        });
      });
    }
    return products;
  });

  metadata["products"] = products;
  return metadata;
}

async function get_product_metadata() {
  let finished = false;
  while (!finished) {
    try {
      await sleep(1000);
      exec("killall chrome");
      await sleep(1000);
      exec(
        '/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222'
      );
      await sleep(3000);

      const browserURL = "http://127.0.0.1:9222";

      const browser = await puppeteer.connect({ browserURL });
      const page = (await browser.pages())[0];

      let products = [];
      // check if the mata file exists
      if (fs.existsSync(path.join(__dirname, "../assets/metadata.json")))
        products = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "../assets/metadata.json"),
            "utf8"
          )
        );
      const brands = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../assets/brands.json"), "utf8")
      );

      for (const bd of brands.slice(products.length)) {
        brandproducts = await get_metadata(page, bd);
        if (brandproducts["products"].length === 0)
          throw new Error("Forced exception: No products!");

        products.push(brandproducts);

        const jsonContent = JSON.stringify(products, null, 2);
        fs.writeFileSync(
          path.join(__dirname, "../assets/metadata.json"),
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
      exec("killall chrome");
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = get_product_metadata;
