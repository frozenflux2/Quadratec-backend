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

  if (progress["details"] == 100)
    await clean_dir(path.join(__dirname, "./assets/data"));

  return progress;
};

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
  const producturls = data.map((x) => x["url"]);

  const new_data = [];
  for (let dt of data) {
    if (Array.isArray(dt["options"]) && dt["url"].split("/").length <= 6) {
      let new_options = [];
      for (const op of dt["options"]) {
        if (op["details"] != "not found" && op["details"] != "403 Forbidden")
          new_options.push(op);
      }
      if (new_options.length > 1) new_options = new_options.slice(1);
      new_data.push({
        options: new_options,
        brand: dt["brand"],
        category: dt["category"],
        title: dt["title"],
        url: dt["url"],
        details: new_options[0]["details"],
      });
    }
  }
  return new_data;
}

function refactor(data) {
  let refactoredData = [];
  let count = 0;

  data.forEach((dt) => {
    const seperatedurl = dt.url.split("/");
    const handle = seperatedurl[seperatedurl.length - 1];
    const title = dt.title;
    const body = dt.details;
    const vendor = dt.brand;
    const category = dt.category;

    dt.options.forEach((option, oid) => {
      const mfgnumber = option.mfgnumber;
      let finalprice = option.finalprice;
      let oldprice = option.oldprice || "0";

      let num_finalprice = parseFloat(finalprice.replace(/,/g, ""));
      let num_oldprice = parseFloat(oldprice.replace(/,/g, ""));
      if (isNaN(num_finalprice)) num_finalprice = 0;

      if (num_oldprice > num_finalprice * 1.7) {
        oldprice = finalprice;
        count++;
      }
      if (num_oldprice === 0 || num_oldprice < num_finalprice) {
        oldprice = finalprice;
      }
      const optionname = option.optionname;
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
          "Option1 Name": "Part #",
          "Option1 Value": optionname,
          "Variant SKU": mfgnumber,
          "Variant Price": finalprice,
          "Variant Compare At Price": oldprice,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
          "Variant Barcode": "",
          "Image Src": img,
          "Image Position": i + 1,
          "Image Alt Text": "",
          "Gift Card": "",
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
          "Variant Weight Unit": "",
          "Variant Tax Code": "",
          "Cost per item": "",
          "Included / United States": "",
          "Price / United States": "",
          "Compare At Price / United States": "",
          "Included / International": "",
          "Price / International": "",
          "Compare At Price / International": "",
          Status: "",
        };

        // options logic
        if (
          optionname === "original" ||
          dt.options.length === 1 ||
          oid !== 0 ||
          i !== 0
        ) {
          tempPd["Option1 Name"] = "";
          tempPd["Option1 Value"] = "";
        }

        if (oid !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
        }

        if (i !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd["Variant SKU"] = "";
          tempPd["Variant Price"] = "";
          tempPd["Variant Compare At Price"] = "";
          tempPd["Product Category"] = "";
          tempPd["Variant Requires Shipping"] = "";
          tempPd["Variant Taxable"] = "";
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

  const csv = Papa.unparse(data);
  fs.writeFileSync(outputPath, csv, "utf8");
  console.log(
    `The JSON data has been successfully converted to '${outputPath}'.`
  );
}

function zipFile(filePath, outputZipPath, compressionLevel = "DEFLATE") {
  const zip = new JSZip();
  const fileName = path.basename(filePath);

  fs.readFile(filePath, function (err, data) {
    if (err) throw err;

    // Add the file to the zip
    zip.file(fileName, data, { compression: compressionLevel });

    // Generate the zip file as a buffer
    zip
      .generateAsync({ type: "nodebuffer", compression: compressionLevel })
      .then(function (content) {
        // Write zip file to disk
        fs.writeFile(outputZipPath, content, function (err) {
          if (err) throw err;
          console.log(`Zipped file saved to ${outputZipPath}`);
        });
      });
  });
}

exports.getCSV = async () => {
  data = getAllData();
  new_data = getNewData(data);
  console.log(data.length);
  console.log(new_data.length);

  // const newData = getNewData(data);
  // const removedData = removeDuplicatedData(newData);
  const refactoredData = refactor(new_data);
  convertToCSV(refactoredData, path.join(__dirname, "./assets/output.csv"));
  zipFile(path.join(__dirname, "./assets/output.csv"), "./public/output.zip");

  await sleep(1000);

  return "./public/output.zip";
};
