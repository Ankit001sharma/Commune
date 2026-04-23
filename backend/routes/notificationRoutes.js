const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

router.get("/", protect, controller.getNotifications);
router.put("/:id/read", protect, controller.markAsRead);
router.put("/read-all", protect, controller.markAllAsRead);
router.put("/messages/:targetId/read", protect, controller.markMessagesByTargetRead);

module.exports = router;