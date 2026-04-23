const Notification = require("../models/Notification");
const { sendResponse } = require("../utils/response");

const VALID_SCOPES = new Set(["non-message", "messages", "all"]);

const asStringId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return `${value._id}`;
  return `${value}`;
};

const buildScopeFilter = (userId, scope = "non-message") => {
  const filter = { user: userId };

  if (scope === "messages") {
    filter.type = "message";
    return filter;
  }

  if (scope === "all") {
    return filter;
  }

  filter.type = { $ne: "message" };
  return filter;
};

const normalizeScope = (scope) => {
  const normalized = `${scope || "non-message"}`.toLowerCase();
  return VALID_SCOPES.has(normalized) ? normalized : "non-message";
};

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

    const scope = normalizeScope(req.query.scope);
    const filter = buildScopeFilter(req.user._id, scope);

    if (req.query.unreadOnly === "true") {
      filter.isRead = false;
    }

    const data = await Notification.find(filter)
      .populate("sender", "_id firstName lastName avatar")
      .sort("-createdAt")
      .lean();

    const normalized = data.map((notification) => {
      const senderId =
        asStringId(notification.sender) ||
        asStringId(notification.senderId) ||
        asStringId(notification?.metadata?.senderId);

      const itemId =
        asStringId(notification.itemId) ||
        asStringId(notification?.metadata?.itemId) ||
        (notification.type === "item_save" ? asStringId(notification.targetId) : null);

      const postId =
        asStringId(notification.postId) ||
        asStringId(notification?.metadata?.postId) ||
        (notification.type === "community_interaction" ? asStringId(notification.targetId) : null);

      return {
        ...notification,
        targetId: asStringId(notification.targetId),
        senderId,
        itemId,
        postId,
      };
    });

    sendResponse(res, 200, normalized);
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true }
    );

    sendResponse(res, 200, null, "Notification marked as read");
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
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

    const scope = normalizeScope(req.query.scope);
    const filter = buildScopeFilter(userId, scope);
    filter.isRead = false;

    const result = await Notification.updateMany(filter, { isRead: true });

    sendResponse(
      res,
      200,
      { updated: result.modifiedCount || 0 },
      "Notifications marked as read"
    );
  } catch (error) {
    next(error);
  }
};

exports.markMessagesByTargetRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      {
        user: req.user._id,
        type: "message",
        targetId: `${req.params.targetId}`,
        isRead: false,
      },
      { isRead: true }
    );

    sendResponse(
      res,
      200,
      { updated: result.modifiedCount || 0 },
      "Message notifications marked as read"
    );
  } catch (error) {
    next(error);
  }
};