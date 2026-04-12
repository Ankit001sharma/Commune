const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  const data = await Notification.find({ user: req.user._id })
    .sort("-createdAt");

  res.json({
    status: "success",
    data,
  });
};

exports.markAsRead = async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, {
    isRead: true,
  });

  res.json({ status: "success" });
};