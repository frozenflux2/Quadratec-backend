const router = require("express").Router();
const polyperformanceController = require("../controllers/polyperformance.controller");

router.get("/start", polyperformanceController.start);
router.get("/progress", polyperformanceController.progress);
router.get("/download", polyperformanceController.download);

module.exports = router;
