const express = require("express");
const router = express.Router();
const marketingController = require("../controllers/marketing.controller");

router.get("/marketing/:modulo?", marketingController.get_panel);

module.exports = router;
