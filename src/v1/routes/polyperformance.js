const router = require("express").Router();
const polyperformanceController = require("../controllers/polyperformance");

router.get("/start", polyperformanceController.start);

module.exports = router;
