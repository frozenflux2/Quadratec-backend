const get_brands = require("./src/get_brand");
const get_product_metadata = require("./src/get_product_metadata");
const get_product_details = require("./src/get_product_detail");
const utils = require("./utils");

(async () => {
  const status = await utils.get_progress();

  if (status["brands"] < 100) await get_brands();
  if (status["metadata"] < 100) await get_product_metadata();
  await get_product_details();
})();
