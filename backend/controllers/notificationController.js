const Notification = require("../models/Notification");
const { sendResponse } = require("../utils/response");

const VALID_SCOPES = new Set(["non-message", "messages", "all"]);

const asStringId = (value) => {
  if (!value) return null;

  if (typeof value === "string") return value;

  if (typeof value === "object" && value._id) {
    return `${value._id}`;
  }

  return `${value}`;
};

const buildScopeFilter = (userId, scope = "non-message") => {

  const filter = {
    user: userId,
  };

  if (scope === "messages") {
    filter.type = "message";
    return filter;
  }

  if (scope === "all") {
    return filter;
  }

  filter.type = {
    $ne: "message",
  };

  return filter;
};

const normalizeScope = (scope) => {

  const normalized = `${scope || "non-message"}`.toLowerCase();

  return VALID_SCOPES.has(normalized)
    ? normalized
    : "non-message";
};

// =========================================
// GET NOTIFICATIONS
// =========================================
exports.getNotifications = async (req, res, next) => {

  try {

    const userId = req.user?._id;

    if (!userId) {

      return sendResponse(
        res,
        400,
        null,
        "Authenticated userId is required to fetch notifications"
      );
    }

    // ✅ AUTO DELETE OLD READ MESSAGE NOTIFICATIONS
    await Notification.deleteMany({
      type: "message",
      isRead: true,
      readAt: {
        $lte: new Date(
          Date.now() - 60 * 60 * 1000
        ),
      },
    });

    const scope = normalizeScope(req.query.scope);

    const filter = buildScopeFilter(
      req.user._id,
      scope
    );

    if (req.query.unreadOnly === "true") {
      filter.isRead = false;
    }

    const data = await Notification.find(filter)
      .populate(
        "sender",
        "_id firstName lastName avatar"
      )
      .sort("-createdAt")
      .lean();

    // ✅ KEEP ONLY LATEST MESSAGE NOTIFICATION
    const uniqueMessageSenders = new Set();

    const normalized = data
      .filter((notification) => {

        if (notification.type !== "message") {
          return true;
        }

        const senderId =
          asStringId(notification.sender) ||
          asStringId(notification.senderId) ||
          asStringId(
            notification?.metadata?.senderId
          );

        const key = `${senderId}_${notification.isRead}`;

        if (uniqueMessageSenders.has(key)) {
          return false;
        }

        uniqueMessageSenders.add(key);

        return true;
      })
      .map((notification) => {

        const senderId =
          asStringId(notification.sender) ||
          asStringId(notification.senderId) ||
          asStringId(
            notification?.metadata?.senderId
          );

        const itemId =
          asStringId(notification.itemId) ||
          asStringId(
            notification?.metadata?.itemId
          ) ||
          (notification.type === "item_save"
            ? asStringId(notification.targetId)
            : null);

        const postId =
          asStringId(notification.postId) ||
          asStringId(
            notification?.metadata?.postId
          ) ||
          (notification.type ===
          "community_interaction"
            ? asStringId(notification.targetId)
            : null);

        return {
          ...notification,
          targetId: asStringId(
            notification.targetId
          ),
          senderId,
          itemId,
          postId,
        };
      });

    sendResponse(
      res,
      200,
      normalized
    );

  } catch (error) {

    next(error);
  }
};

// =========================================
// MARK SINGLE NOTIFICATION READ
// =========================================

exports.markNotificationAsRead = async (req, res) => {
  try {

    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // already read
    if (notification.isRead) {
      return res.status(200).json({
        success: true,
        data: notification,
      });
    }

    notification.isRead = true;

    await Notification.updateMany(
    {
      user: notification.user,
      sender: notification.sender,
      type: notification.type,
      targetId: notification.targetId,
      isRead: false,
      _id: { $ne: notification._id },
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );

    await notification.save();

    res.status(200).json({
      success: true,
      data: notification,
    });

  } catch (error) {

    console.error(
      "MARK READ ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// =========================================
// MARK ALL READ
// =========================================
exports.markAllAsRead = async (
  req,
  res,
  next
) => {

  try {

    const userId = req.user?._id;

    if (!userId) {

      return sendResponse(
        res,
        400,
        null,
        "Authenticated userId is required to mark notifications as read"
      );
    }

    const scope = normalizeScope(
      req.query.scope
    );

    const filter = buildScopeFilter(
      userId,
      scope
    );

    filter.isRead = false;

    const result =
      await Notification.updateMany(
        filter,
        {
          isRead: true,
          readAt: new Date(),
        }
      );

    sendResponse(
      res,
      200,
      {
        updated:
          result.modifiedCount || 0,
      },
      "Notifications marked as read"
    );

  } catch (error) {

    next(error);
  }
};

// =========================================
// MARK MESSAGE NOTIFICATIONS READ
// =========================================
exports.markMessagesByTargetRead = async (
  req,
  res,
  next
) => {

  try {

    const result =
      await Notification.updateMany(
        {
          user: req.user._id,
          type: "message",
          targetId: `${req.params.targetId}`,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

    sendResponse(
      res,
      200,
      {
        updated:
          result.modifiedCount || 0,
      },
      "Message notifications marked as read"
    );

  } catch (error) {

    next(error);
  }
};