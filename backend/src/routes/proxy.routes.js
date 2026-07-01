const express = require("express");
const router = express.Router();

const { chatCompletions } = require("../controllers/proxy.controller");

router.post("/v1/chat/completions", chatCompletions);

module.exports = router;