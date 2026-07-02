const express = require("express");
const router = express.Router();

const {
  getOverview,
  getForecast,
  getRecommendations,
  getRequests,
  getConsumers,
  getAlerts,
  patchConsumerBudget,
  markAlertAsRead
} = require("../controllers/dashboard.controller");

router.get("/dashboard/overview", getOverview);
router.get("/dashboard/forecast", getForecast);
router.get("/recommendations", getRecommendations);
router.get("/requests", getRequests);
router.get("/consumers", getConsumers);
router.get("/alerts", getAlerts);

router.patch("/consumers/:id/budget", patchConsumerBudget);
router.patch("/alerts/:id/read", markAlertAsRead);

module.exports = router;