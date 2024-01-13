const get_brands = require("./src/get_brand");
const get_product_metadata = require("./src/get_product_metadata");
const get_product_details = require("./src/get_product_detail");

(async () => {
  await get_brands();
  await get_product_metadata();
  await get_product_details();
})();
