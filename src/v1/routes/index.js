var router = require("express").Router();

router.use("/polyperformance", require("./polyperformance.route"));
router.use("/utils", require("./utils.route"));

module.exports = router;
