const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_metadata(page, url, brandname, categoryname) {
  // Navigate to the specified URL
  await page.goto(url);

  await sleep(1000);

  let products = await page.evaluate(
    (url, brandname, categoryname) => {
      const productDivs = document.querySelectorAll(
        'div[class*="product-info"]'
      );

      let products = [];
      productDivs.forEach((div) => {
        const adiv = div.querySelector("a");

        const finalprice = div
          .querySelector('span[class="product-price"]')
          .textContent.trim();

        const oldpricediv = div.querySelector('span[class="suggested-price"]');
        let oldprice = "";
        if (oldpricediv) oldprice = oldpricediv.textContent.trim();

        const instockdiv = div.querySelector(
          'div[class="serp-stock-status serp-stock-in-stock"]'
        );
        let instock = false;
        if (instockdiv) instock = true;

        products.push({
          brand: brandname,
          category: categoryname,
          "category url": url,
          title: adiv.title,
          url: adiv.href,
          finalprice: finalprice,
          oldprice: oldprice,
          instock: instock,
        });
      });

      return products;
    },
    url,
    brandname,
    categoryname
  );

  if (categoryname !== "") {
    let pagenumber = 1;

    while (true) {
      await page.goto(`${url}?page=${pagenumber}`);
      console.log(`${url}?page=${pagenumber}`);

      await sleep(1000);
      const page_products = await page.evaluate(
        (url, brandname, categoryname) => {
          const productDivs = document.querySelectorAll(
            'div[class*="product-info"]'
          );

          let products = [];
          productDivs.forEach((div) => {
            const adiv = div.querySelector("a");

            const finalprice = div
              .querySelector('span[class="product-price"]')
              .textContent.trim();

            const oldpricediv = div.querySelector(
              'span[class="suggested-price"]'
            );
            let oldprice = "";
            if (oldpricediv) oldprice = oldpricediv.textContent.trim();

            const instockdiv = div.querySelector(
              'div[class="serp-stock-status serp-stock-in-stock"]'
            );
            let instock = false;
            if (instockdiv) instock = true;

            products.push({
              brand: brandname,
              category: categoryname,
              "category url": url,
              title: adiv.title,
              url: adiv.href,
              finalprice: finalprice,
              oldprice: oldprice,
              instock: instock,
            });
          });

          return products;
        },
        url,
        brandname,
        categoryname
      );

      products = products.concat(page_products);

      pagenumber++;
      if (page_products.length === 0) break;
    }
  }

  return products;
}

async function get_product_metadata(numberofprocess = 4) {
  const categories = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/categories.json"), "utf8")
  )["data"];

  const chunksize = Math.ceil(categories.length / numberofprocess);

  // create directory if metadata doesn't exist
  if (!fs.existsSync(path.join(__dirname, "../assets/metadata")))
    fs.mkdirSync(path.join(__dirname, "../assets/metadata"), {
      recursive: true,
    });

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
        // exec('killall chrome');

        // create directory if sub metadata doesn't exist
        if (
          !fs.existsSync(
            path.join(__dirname, `../assets/metadata/metadata${processnumber}`)
          )
        )
          fs.mkdirSync(
            path.join(__dirname, `../assets/metadata/metadata${processnumber}`),
            {
              recursive: true,
            }
          );

        let numberoffiles = fs.readdirSync(
          path.join(__dirname, `../assets/metadata/metadata${processnumber}`)
        ).length;
        // if (numberoffiles === 0) numberoffiles++;

        for (const brand of categories.slice(
          chunksize * processnumber + numberoffiles,
          chunksize * (processnumber + 1)
        )) {
          const brandname = brand["brand"];
          // await sleep(3000000)
          // load data
          let data = [];
          console.log("New Brand:    ", brandname);

          // get meta data
          const categories_withbrands = brand["categories"];
          if (categories_withbrands.length === 0) {
            console.log("no categories", brand["brand url"]);
            data = data.concat(
              await get_metadata(page, brand["brand url"], brandname, "")
            );
          } else {
            for (const cb of categories_withbrands.slice(data.length))
              data = data.concat(
                await get_metadata(
                  page,
                  cb["category url"],
                  brandname,
                  cb["category"]
                )
              );
          }

          const jsonContent = JSON.stringify(data, null, 2);
          fs.writeFileSync(
            path.join(
              __dirname,
              `../assets/metadata/metadata${processnumber}/${brandname}.json`
            ),
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

        browser.close();
        finished = true;
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
    const dir = path.join(__dirname, "../assets/metadata");
    const subdirs = fs.readdirSync(dir);

    for (const sd of subdirs) {
      const fullPath = `${dir}/${sd}`;
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  });
  // await singleProcess(0)
}

module.exports = get_product_metadata;
