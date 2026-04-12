const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

router.get("/", protect, controller.getNotifications);
router.put("/:id/read", protect, controller.markAsRead);

module.exports = router;

console.log("✅ Notification routes loaded");