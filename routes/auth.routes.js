const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.get("/", authController.get_login);
router.post("/login", authController.post_login);
router.get("/logout", authController.get_logout);

module.exports = router;
