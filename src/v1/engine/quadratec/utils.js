const fs = require("fs");
const path = require("path");
const Papa = require("papaparse"); // Including papaparse for CSV operations
const JSZip = require("jszip");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function count_files(dir) {
  let count = 0;
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (fs.statSync(fullPath).isFile()) {
      count += 1;
    } else {
      count += fs.readdirSync(fullPath).length;
    }
  }

  return count;
}

async function clean_file(file) {
  if (!file["completed"]) {
    file["completed"] = true;

    let data = [];
    for (const subcat of categories["data"]) data = data.concat(subcat);
    file["data"] = data;

    const jsonContent = JSON.stringify(file, null, 2);

    fs.writeFileSync(
      path.join(__dirname, "./assets/categories.json"),
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

async function clean_dir(dir) {
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (!fs.statSync(fullPath).isFile()) {
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  }
}

exports.get_progress = async () => {
  let progress = {
    brands: 0.0,
    categories: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(path.join(__dirname, `./assets/brands.json`))) {
    progress["brands"] = 100.0;
    numberofbrands = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/brands.json"), "utf8")
    ).length;
  } else {
    return progress;
  }

  if (fs.existsSync(path.join(__dirname, `./assets/categories.json`))) {
    // get categories process
    const categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/categories.json"), "utf8")
    );
    if (categories["completed"])
      progress["categories"] =
        (categories["data"].length / numberofbrands) * 100;
    else {
      let count = 0;
      for (const subcat of categories["data"]) count += subcat.length;
      progress["categories"] = (count / numberofbrands) * 100;
    }
  } else {
    return progress;
  }

  // get metadata process
  if (
    fs.existsSync(path.join(__dirname, `./assets/metadata`)) &&
    progress["categories"] == 100.0
  ) {
    const categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/categories.json"), "utf8")
    );
    await clean_file(categories);
    progress["metadata"] =
      ((await count_files(path.join(__dirname, "./assets/metadata"))) /
        numberofbrands) *
      100;
  }

  // get details process
  if (
    fs.existsSync(path.join(__dirname, `./assets/data`)) &&
    progress["metadata"] == 100.0
  ) {
    await clean_dir(path.join(__dirname, `./assets/metadata`));
    progress["details"] =
      ((await count_files(path.join(__dirname, "./assets/data"))) /
        numberofbrands) *
      100;
  }

  // if (progress["details"] == 100)
  //   await clean_dir(path.join(__dirname, "./assets/data"));

  return progress;
};

function parseWeight(input) {
  if (input === "") return "";
  const weightPattern = /([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)/;

  let matches = input.match(weightPattern);

  if (matches && matches.length > 1) {
    // If unit is not provided (empty string), return weight with an empty string as the unit
    return parseFloat(matches[1]) * 453.59237;
  } else {
    throw new Error("Input format is incorrect");
  }
}

function getAllData() {
  const subdirs = fs.readdirSync(path.join(__dirname, "./assets/data"));

  data = [];
  for (const sd of subdirs) {
    const fullPath = path.join(__dirname, `./assets/data/${sd}`);
    if (!fs.statSync(fullPath).isFile()) {
      const filenames = fs.readdirSync(fullPath);
      for (const fn of filenames) {
        const path = `${fullPath}/${fn}`;
        data = data.concat(JSON.parse(fs.readFileSync(path, "utf8")));
      }
    } else {
      data = data.concat(JSON.parse(fs.readFileSync(fullPath, "utf8")));
    }
  }

  return data;
}

function getNewData(data) {
  const new_data = [];
  for (let dt of data) {
    if (
      Array.isArray(dt["options"]) &&
      dt["url"].split("/").length <= 6 &&
      !dt["url"].includes[".htm/"]
    ) {
      let new_options = [];
      for (const op of dt["options"]) {
        if (op["details"] != "not found" && op["details"] != "403 Forbidden")
          new_options.push(op);
      }
      // if (new_options.length > 1) new_options = new_options.slice(1);
      let new_body = dt.body;
      if (
        dt.body.includes(
          '<div   id="learn" ><br><h2>Learn More</h2>\n<div >\n<div >\n'
        )
      )
        new_body = dt.body.replace("<div ><br><h3>", "<div ><h3>");

      new_data.push({
        options: new_options,
        optionnames: dt["optionnames"],
        brand: dt["brand"],
        category: dt["category"],
        title: dt["title"],
        url: dt["url"],
        body: new_body,
      });
    }
  }
  return new_data;
}

function addImages(data) {
  const new_data = [];
  for (const dt of data) {
    let new_options = [];

    let original_images = undefined;
    let new_images = undefined;
    dt.options.forEach((option, oid) => {
      if (oid === 0) {
        original_images = option.imgs.filter((item, index, self) => {
          return self.indexOf(item) === index;
        });
        new_images = original_images.slice();
      } else {
        new_images = original_images.slice();
        if (option.imgs[0] !== "") {
          new_images[0] = option.imgs[0];
        }
      }
      new_options.push({
        catalognumber: option.catalognumber,
        mfgnumber: option.mfgnumber,
        oldprice: option.oldprice,
        finalprice: option.finalprice,
        instock: option.instock,
        weight: option.weight,
        imgs: new_images,
        values: option.values,
      });
    });

    if (new_options.length > 1) new_options = new_options.slice(1);
    new_data.push({
      options: new_options,
      optionnames: dt["optionnames"],
      brand: dt["brand"],
      category: dt["category"],
      title: dt["title"],
      url: dt["url"],
      body: dt["body"],
    });
  }

  return new_data;
}

async function convertImages(data) {
  const image_table = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/image_table.json"), "utf8")
  );

  const browser = await puppeteer.launch({ headless: false });

  // Open a page to download
  const download_page = await browser.newPage();
  // Set the navigation timeout (in milliseconds)
  await download_page.setDefaultNavigationTimeout(300000); // Timeout after 300 seconds
  let download_flag = false;
  download_page.on("response", async (response) => {
    if (
      response.url().includes("https://www.quadratec.com/sites/") &&
      response.request().method() === "GET"
    ) {
      download_flag = true;
      const imgurl = response.url();
      const format = imgurl.split(".")[imgurl.split(".").length - 1];

      const buffer = await response.buffer(); // Gets the response body as a buffer

      if (!image_table.hasOwnProperty(imgurl) && format !== "pdf") {
        const uid = randomUUID(); // Gets the UUID
        try {
          fs.writeFileSync(`./assets/images/${uid}.${format}`, buffer); // Write the buffer to a file
        } catch (error) {
          console.log(page.url());
          console.log(imgurl);
          throw new Error("Page error caught:");
        }

        image_table[imgurl] = `${uid}.${format}`;
        jsonContent = JSON.stringify(image_table, null, 2);
        fs.writeFileSync(
          `./assets/image_table.json`,
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

      download_flag = false;
    }
  });

  const new_data = [];

  for (const dt of data) {
    const new_options = [];
    // convert images from options
    for (const option of dt.options) {
      const new_images = [];

      for (const img of option.imgs) {
        if (!image_table[img]) {
          console.log("image not found", img, dt.url, option.imgs, dt.brand);
          // wait by download page is ready
          while (download_flag) await sleep(300);

          await sleep(100);
          await download_page.goto(img);
          await sleep(1000);
        }
        new_images.push(`https://model.ngrok.dev/images/${image_table[img]}`);
      }
      new_options.push({
        catalognumber: option.catalognumber,
        mfgnumber: option.mfgnumber,
        oldprice: option.oldprice,
        finalprice: option.finalprice,
        instock: option.instock,
        weight: option.weight,
        imgs: new_images,
        values: option.values,
      });
    }

    new_data.push({
      options: new_options,
      optionnames: dt["optionnames"],
      brand: dt["brand"],
      category: dt["category"],
      title: dt["title"],
      url: dt["url"],
      body: dt.body,
    });
  }

  await browser.close();
  return new_data;
}

function refactor(data) {
  let refactoredData = [];
  let count = 0;

  data.forEach((dt) => {
    const seperatedurl = dt.url.split("/");
    const handle = seperatedurl[seperatedurl.length - 1];
    const title = dt.title;
    const body = dt.body;
    const vendor = dt.brand;
    const optionnames = dt.optionnames;

    dt.options.forEach((option, oid) => {
      const mfgnumber = option.mfgnumber;
      const catalognumber = option.catalognumber;
      const weight = parseWeight(option.weight);
      let finalprice = option.finalprice;
      let oldprice = option.oldprice;
      if (oldprice === "") oldprice = finalprice;

      let inventorytracker = "";
      let inventorypolicy = "";
      if (
        option["instock"] === "In Stock" ||
        option["instock"] === "Ships from 3rd Party"
      )
        inventorypolicy = "continue";
      else {
        inventorytracker = "shopify";
        inventorypolicy = "deny";
      }
      const optionvalues = option.values;
      option.imgs.forEach((img, i) => {
        let tempPd = {
          Handle: handle,
          Title: title,
          "Body (HTML)": body,
          Vendor: vendor,
          "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories",
          Type: "",
          Tags: "",
          Published: "",
          "Option1 Name": "",
          "Option1 Value": "",
          "Option2 Name": "",
          "Option2 Value": "",
          "Option3 Name": "",
          "Option3 Value": "",
          "Variant SKU": catalognumber,
          "Variant Grams": weight,
          "Variant Weight Unit": "lbs",
          "Variant Inventory Tracker": inventorytracker,
          "Variant Inventory Policy": inventorypolicy,
          "Variant Fulfillment Service": "manual",
          "Variant Price": finalprice,
          "Variant Compare At Price": oldprice,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
          "Variant Barcode": mfgnumber,
          "Image Src": img,
          "Image Position": i + 1,
          "Image Alt Text": "",
          "Gift Card": "FALSE",
          "SEO Title": "",
          "SEO Description": "",
          "Google Shopping / Google Product Category": "",
          "Google Shopping / Gender": "",
          "Google Shopping / Age Group": "",
          "Google Shopping / MPN": "",
          "Google Shopping / Condition": "",
          "Google Shopping / Custom Product": "",
          "Google Shopping / Custom Label 0": "",
          "Google Shopping / Custom Label 1": "",
          "Google Shopping / Custom Label 2": "",
          "Google Shopping / Custom Label 3": "",
          "Google Shopping / Custom Label 4": "",
          "Variant Image": "",
          "Variant Tax Code": "",
          "Cost per item": "",
          "Included / United States": "TRUE",
          "Price / United States": "",
          "Compare At Price / United States": "",
          "Included / International": "TRUE",
          "Price / International": "",
          "Compare At Price / International": "",
        };

        // options logic
        if (
          optionvalues == ["original"] ||
          dt.options.length === 1 ||
          oid + i > 0
        ) {
          tempPd["Option1 Name"] = "";
          tempPd["Option1 Value"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option2 Value"] = "";
          tempPd["Option3 Name"] = "";
          tempPd["Option3 Value"] = "";
        }

        if (i !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd["Variant SKU"] = "";
          tempPd["Variant Inventory Tracker"] = "";
          tempPd["Variant Inventory Policy"] = "";
          tempPd["Variant Fulfillment Service"] = "";
          tempPd["Variant Price"] = "";
          tempPd["Variant Compare At Price"] = "";
          tempPd["Product Category"] = "";
          tempPd["Option1 Name"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option3 Name"] = "";
          tempPd["Variant Requires Shipping"] = "";
          tempPd["Variant Taxable"] = "";
          tempPd["Variant Barcode"] = "";
          tempPd["Gift Card"] = "";
          tempPd["Variant Grams"] = "";
          tempPd["Variant Weight Unit"] = "";
          tempPd["Included / United States"] = "";
          tempPd["Included / International"] = "";
        }

        if (oid > 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd["Option1 Name"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option3 Name"] = "";
        }
        try {
          if (i === 0 && optionvalues[0] != ["original"]) {
            for (let i = 0; i < optionvalues.length; i++) {
              if (i > 2) {
                tempPd["Option3 Name"] += ` and ${optionnames[i]}`;
                tempPd["Option3 Value"] += ` and ${optionvalues[i]}`;
              } else {
                tempPd[`Option${i + 1} Name`] = optionnames[i];
                tempPd[`Option${i + 1} Value`] = optionvalues[i];
              }
            }
          }
        } catch (error) {
          console.log("empty values", dt.url);
        }
        refactoredData.push(tempPd);
      });
    });
  });

  console.log(count);
  return refactoredData;
}

function convertToCSV(data, outputPath) {
  // Here you would implement or use a library to write the CSV.
  // Since papaparse is a popular choice, this example will use it.

  const bom = "\uFEFF";
  const csv =
    bom +
    Papa.unparse(data, {
      encoding: "utf-8",
    });
  fs.writeFileSync(outputPath, csv, "utf8");
  console.log(
    `The JSON data has been successfully converted to '${outputPath}'.`
  );
}

const zipFile = (filePath, outputZipPath, compressionLevel = "DEFLATE") => {
  const zip = new JSZip();
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        zip.file(fileName, data, { compression: compressionLevel });

        // Generate the zip file as a buffer
        zip
          .generateAsync({ type: "nodebuffer", compression: compressionLevel })
          .then((content) => {
            // Wrap fs.writeFile in another Promise
            fs.writeFile(outputZipPath, content, (writeErr) => {
              if (writeErr) {
                reject(writeErr);
              } else {
                console.log(`Zipped file saved to ${outputZipPath}`);
                resolve(); // Resolve the outer Promise
              }
            });
          })
          .catch(reject); // Reject the outer Promise on error here
      }
    });
  });
};

exports.getCSV = async () => {
  const data = getAllData();
  const new_data = getNewData(data);
  const addedData = addImages(new_data);
  const convertedData = await convertImages(addedData);
  console.log(data.length);
  console.log(new_data.length);
  console.log(addedData.length);
  console.log(convertedData.length);

  const refactoredData = refactor(convertedData);
  convertToCSV(refactoredData, "./assets/output.csv");

  try {
    await zipFile(
      path.join(__dirname, "./assets/output.csv"),
      "./public/output.zip"
    );
    console.log("Done zipping");
    return "./public/output.zip";
  } catch (error) {
    console.log("Error on zipping: ", error);
    return null;
  }
};
