const puppeteer = require("puppeteer");
const fs = require("fs");
const { JSDOM } = require("jsdom");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_details(page, optionname) {
  console.log(page.url());
  // To get all div elements with class 'pricing-block'
  const elements = await page.$$(".pricing-block"); // Note the use of `$$` for multiple elements

  const product = await page.evaluate((ele) => {
    const catalogDiv = ele.querySelector('div[class="part-num catalog"]');
    let catalognumber = "";
    if (catalogDiv)
      catalognumber = catalogDiv
        .querySelector('span[class="num-value"]')
        .textContent.trim();

    const mfgDiv = ele.querySelector('div[class="part-num mfg"]');
    let mfgnumber = "";
    if (mfgDiv) {
      mfgnumber = mfgDiv
        .querySelector('span[class="num-value"]')
        .textContent.trim();
    }

    const msrpDiv = ele.querySelector('div[class="pricing-row msrp"]');
    let oldprice = "";
    if (msrpDiv) oldprice = msrpDiv.textContent.trim().slice(5);

    const priceDiv = ele.querySelector('div[class="best-price"]');
    let finalprice = "";
    if (priceDiv) finalprice = priceDiv.textContent.trim().slice(1);

    const instockDiv = ele.querySelector('div[class*="stock-status"]');
    let instock = "";
    if (instockDiv) instock = instockDiv.textContent.trim();

    const descriptionDiv = document.querySelector(
      'div[class="product-section description"]'
    );
    let description = "";
    if (descriptionDiv)
      description = descriptionDiv
        .querySelector('div[class="section-content"]')
        .textContent.trim();

    const detailsDiv = document.querySelector('div[class="col-md-8"]');
    let details = "";
    if (detailsDiv)
      details = detailsDiv
        .querySelector('div[class="product-section"]')
        .querySelector('div[class="section-content"]')
        .innerHTML.trim();

    const imgDivs = document.querySelectorAll(
      'div[class="media media--image media--loaded"]'
    );
    let imgs = [];
    imgDivs.forEach((div) => {
      imgs.push(div.querySelector("img").src);
    });

    product = {
      catalognumber: catalognumber,
      mfgnumber: mfgnumber,
      oldprice: oldprice,
      finalprice: finalprice,
      instock: instock,
      imgs: imgs,
      description: description,
      details: details,
    };
    return product;
  }, elements[0]);
  product["values"] = [optionname];
  return product;
}

async function get_option_details(nid, product_id, values) {
  const baseURL = `https://www.quadratec.com/nocache/product_ajax/${nid}/${product_id}/`;

  // get image
  const img = await fetch(`${baseURL}images`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Image Fetch Error! status: ${response.status}`);
      }
      // Parse the JSON response
      return response.json();
    })
    .then((data) => {
      return data.img;
    })
    .catch((error) => {
      console.log("Empty Image");
      return "";
    });

  // get details
  const html_content = await fetch(`${baseURL}details_json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Details Fetch Error! status: ${response.status}`);
      }
      // Parse the JSON response
      return response.json();
    })
    .then((data) => {
      return data;
    });

  // Create a new instance of the DOMParser
  const dom = new JSDOM(html_content);

  const catalogDiv = dom.window.document.querySelector(
    'div[class="part-num catalog"]'
  );
  let catalognumber = "";
  if (catalogDiv)
    catalognumber = catalogDiv
      .querySelector('span[class="num-value"]')
      .textContent.trim();

  const mfgDiv = dom.window.document.querySelector('div[class="part-num mfg"]');
  let mfgnumber = "";
  if (mfgDiv) {
    mfgnumber = mfgDiv
      .querySelector('span[class="num-value"]')
      .textContent.trim();
  }

  const msrpDiv = dom.window.document.querySelector(
    'div[class="pricing-row msrp"]'
  );
  let oldprice = "";
  if (msrpDiv) oldprice = msrpDiv.textContent.trim().slice(5);

  const priceDiv = dom.window.document.querySelector('div[class="best-price"]');
  let finalprice = "";
  if (priceDiv) finalprice = priceDiv.textContent.trim().slice(1);

  const instockDiv = dom.window.document.querySelector(
    'div[class*="stock-status"]'
  );
  let instock = "";
  if (instockDiv) instock = instockDiv.textContent.trim();

  const details = {
    catalognumber: catalognumber,
    mfgnumber: mfgnumber,
    oldprice: oldprice,
    finalprice: finalprice,
    instock: instock,
    imgs: [img],
    values: values,
  };

  return details;
}

async function get_options(page) {
  const optionmetadata = await page.evaluate(() => {
    const optionmetadata = { nid: "", names: [], values: [] };

    const nidDiv = document.querySelector('div[id="nid"]');
    if (nidDiv) optionmetadata.nid = nidDiv.textContent.trim();

    const optionnameDivs = document.querySelectorAll(
      'label[class="control-label"]'
    );
    optionnameDivs.forEach((div) => {
      optionmetadata.names.push(div.innerText);
    });

    const v2jsonDiv = document.querySelector('div[id="v2json"]');
    if (v2jsonDiv) {
      console.log("v2jsonDiv founded...");
      const v2json = JSON.parse(v2jsonDiv.textContent.trim());
      for (const om of Object.values(v2json)) {
        optionmetadata.values.push({
          product_id: om["product_id"],
          values: om["values"],
        });
      }
      return optionmetadata;
    }

    const jsonselectDiv = document.querySelector(
      'span[id="json-select-boxes"]'
    );
    if (jsonselectDiv) {
      console.log("jsonselectDiv founded...");
      const jsonselect = JSON.parse(jsonselectDiv.textContent.trim());

      const get_select = (om, data) => {
        if (Object.keys(data).length === 0) {
          optionmetadata.values.push(om);
          return;
        } else {
          for (const key of Object.keys(data)) {
            let localom = {
              product_id: data[key]["product_id"],
              values: om["values"].slice(),
            };
            localom["values"].push(key);
            get_select(localom, data[key]["next_step"]);
          }
          return;
        }
      };

      get_select({ product_id: "", values: [] }, jsonselect["init"]);
      return optionmetadata;
    }
    return optionmetadata;
  });

  return optionmetadata;
}

async function get_product(page, metadata) {
  const count = metadata["url"].split("/").length - 1;
  if (count > 5) {
    // metadata['options'] = 'duplicated';
    console.log("duplicated  ", metadata["url"]);

    return {
      options: "duplicated",
      title: metadata["title"],
      url: metadata["url"],
    };
  }
  // Navigate to the specified URL
  await page.goto(metadata["url"]);
  await sleep(1000);

  // If product is empty
  const cancelDiv = await page.evaluate(() => {
    const cancelDiv = document.querySelector('div[class="cancelled-banner"]');
    return cancelDiv;
  });

  if (cancelDiv) {
    console.log("empty  ", metadata["url"]);

    return {
      options: "empty",
      title: metadata["title"],
      url: metadata["url"],
    };
  }
  const optionData = [];

  // get original options
  optionData.push(await get_details(page, "original"));

  // get variants
  const optionmetadata = await get_options(page);

  for (const md of optionmetadata.values) {
    optionData.push(
      await get_option_details(
        optionmetadata["nid"],
        md["product_id"],
        md["values"]
      )
    );
  }

  product = {
    options: optionData,
    optionnames: optionmetadata.names,
    brand: metadata["brand"],
    category: metadata["category"],
    title: metadata["title"],
    url: metadata["url"],
  };

  return product;
}

async function get_product_details(numberofprocess = 4) {
  const brands = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/brands.json"), "utf8")
  );
  const chunksize = Math.ceil(brands.length / numberofprocess);

  // create directory if data doesn't exist
  if (!fs.existsSync(path.join(__dirname, "../assets/data")))
    fs.mkdirSync(path.join(__dirname, "../assets/data"), { recursive: true });

  const browsers = [];

  const singleProcess = async (processnumber) => {
    if (processnumber != 3) return;
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
        // create directory if data doesn't exist
        if (
          !fs.existsSync(
            path.join(__dirname, `../assets/data/data${processnumber}`)
          )
        )
          fs.mkdirSync(
            path.join(__dirname, `../assets/data/data${processnumber}`),
            {
              recursive: true,
            }
          );
        let numberoffiles = fs.readdirSync(
          path.join(__dirname, `../assets/data/data${processnumber}`)
        ).length;
        if (numberoffiles === 0) numberoffiles++;

        for (const brand of brands.slice(
          chunksize * processnumber + numberoffiles - 1,
          chunksize * (processnumber + 1)
        )) {
          const brandname = brand["name"];
          let meta = JSON.parse(
            fs.readFileSync(
              path.join(__dirname, `../assets/metadata/${brandname}.json`),
              "utf8"
            )
          );

          let data = [];
          try {
            data = JSON.parse(
              fs.readFileSync(
                path.join(
                  __dirname,
                  `../assets/data/data${processnumber}/${brandname}.json`
                ),
                "utf8"
              )
            );
          } catch (error) {
            console.log("New Brand:    ", brandname);
            data = [];
            fs.writeFileSync(
              path.join(
                __dirname,
                `../assets/data/data${processnumber}/${brandname}.json`
              ),
              "[]",
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

          for (const mt of meta.slice(data.length)) {
            const product = await get_product(page, mt);
            data.push(product);

            const jsonContent = JSON.stringify(data, null, 2);
            fs.writeFileSync(
              path.join(
                __dirname,
                `../assets/data/data${processnumber}/${brandname}.json`
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
    const dir = path.join(__dirname, "../assets/data");
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
}

module.exports = get_product_details;
