const Listing = require('../models/Listing');
const Post = require('../models/Post');
const Service = require('../models/Service');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { sendResponse } = require('../utils/response');
const { emitNotificationToUser } = require('../services/socketService');

const ITEM_TYPE_TO_MODEL = {
  listing: 'Listing',
  service: 'Service',
  post: 'Post',
};

const ITEM_TYPE_TO_OWNER_FIELD = {
  listing: 'seller',
  service: 'provider',
  post: 'author',
};

const ITEM_TYPE_TO_STATUS_FILTER = {
  listing: { status: { $ne: 'removed' } },
  service: { status: { $ne: 'removed' } },
  post: { status: { $ne: 'removed' } },
};

const normalizeItemType = (value) => {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (normalized === 'listing') return 'listing';
  if (normalized === 'service') return 'service';
  if (normalized === 'post') return 'post';
  return null;
};

const getItemByType = async (itemId, itemType) => {
  if (itemType === 'listing') {
    return Listing.findOne({ _id: itemId, ...ITEM_TYPE_TO_STATUS_FILTER.listing }).select('title tags seller');
  }
  if (itemType === 'service') {
    return Service.findOne({ _id: itemId, ...ITEM_TYPE_TO_STATUS_FILTER.service }).select('title tags provider');
  }
  return Post.findOne({ _id: itemId, ...ITEM_TYPE_TO_STATUS_FILTER.post }).select('title tags author');
};

exports.saveItem = async (req, res, next) => {
  try {
    const { itemId } = req.body;
    const itemType = normalizeItemType(req.body.itemType);

    console.log('SAVE HIT:', req.body);
    console.log('USER:', req.user ? { id: req.user._id, email: req.user.email } : null);

    console.log('[SaveItem] Request', {
      userId: req.user?._id?.toString(),
      itemId,
      itemType,
    });

    if (!itemType) {
      return next(new AppError('itemType must be one of listing, service, or post.', 400));
    }

    const item = await getItemByType(itemId, itemType);
    if (!item) {
      return next(new AppError(`${itemType} not found.`, 404));
    }

    const ownerField = ITEM_TYPE_TO_OWNER_FIELD[itemType];
    if (item[ownerField]?.toString() === req.user._id.toString()) {
      return next(new AppError(`You cannot save your own ${itemType}.`, 400));
    }

    const user = await User.findById(req.user._id);
    const existingIndex = user.savedItems.findIndex(
      (saved) => saved.item.toString() === itemId && saved.itemType === itemType
    );

    let saved;
    if (existingIndex > -1) {
      user.savedItems.splice(existingIndex, 1);
      saved = false;
    } else {
      user.savedItems.push({
        item: item._id,
        itemType,
        itemTypeModel: ITEM_TYPE_TO_MODEL[itemType],
        tags: (item.tags || []).map((tag) => `${tag}`.trim().toLowerCase()).filter(Boolean),
        savedAt: new Date(),
      });
      saved = true;
    }

    // Keep backward compatibility for legacy listing favorites UI/data.
    if (itemType === 'listing') {
      const listingId = item._id.toString();
      const favoriteIndex = user.favorites.findIndex((f) => f.toString() === listingId);
      if (saved && favoriteIndex === -1) user.favorites.push(item._id);
      if (!saved && favoriteIndex > -1) user.favorites.splice(favoriteIndex, 1);

      const listing = await Listing.findById(item._id);
      if (listing) {
        const favoritedByIndex = listing.favoritedBy.findIndex((f) => f.toString() === req.user._id.toString());
        if (saved && favoritedByIndex === -1) listing.favoritedBy.push(req.user._id);
        if (!saved && favoritedByIndex > -1) listing.favoritedBy.splice(favoritedByIndex, 1);
        await listing.save({ validateBeforeSave: false });
      }
    }

    await user.save({ validateBeforeSave: false });

    if (saved) {
      const ownerField = ITEM_TYPE_TO_OWNER_FIELD[itemType];
      const ownerId = item[ownerField]?.toString();

      if (ownerId && ownerId !== req.user._id.toString()) {
        const senderName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'Someone';
        const itemName = `${item.title || itemType}`;

        const notification = await Notification.create({
          user: ownerId,
          type: 'item_save',
          sender: req.user._id,
          senderName,
          targetId: item._id.toString(),
          text: `User ${senderName} saved your item ${itemName}`,
          metadata: {
            itemType,
            itemId: item._id.toString(),
            itemName,
          },
        });

        emitNotificationToUser(ownerId, notification);
      }
    }

    console.log('[SaveItem] Updated', {
      userId: req.user?._id?.toString(),
      itemId,
      itemType,
      saved,
      totalSavedItems: user.savedItems.length,
    });

    sendResponse(
      res,
      200,
      {
        saved,
        itemId,
        itemType,
        savedItems: user.savedItems,
      },
      saved ? `${itemType} saved` : `${itemType} removed from saved items`
    );
  } catch (error) {
    next(error);
  }
};
exports.getSavedItems = async (req, res, next) => {
  try {
    console.log('[SavedItems] Fetch', { userId: req.user?._id?.toString() });

    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const results = await Promise.all(
      user.savedItems.map(async (entry) => {
        let itemData = null;

        if (entry.itemType === 'listing') {
          itemData = await Listing.findById(entry.item)
            .populate('seller', 'firstName lastName avatar');
        } else if (entry.itemType === 'service') {
          itemData = await Service.findById(entry.item)
            .populate('provider', 'firstName lastName avatar');
        } else if (entry.itemType === 'post') {
          itemData = await Post.findById(entry.item)
            .populate('author', 'firstName lastName avatar');
        }

        if (!itemData) return null;

        return {
          ...entry.toObject(),
          item: itemData,
        };
      })
    );

    const savedItems = results
      .filter(Boolean)
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    console.log('[SavedItems] Result', {
      userId: req.user?._id?.toString(),
      count: savedItems.length,
    });

    sendResponse(res, 200, savedItems, 'Saved items fetched successfully');
  } catch (error) {
    console.error('❌ ERROR getSavedItems:', error);
    next(error);
  }
};

exports.getActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const rawType = `${req.query.type || ''}`.toLowerCase();
    const type = rawType === 'likes' ? 'like' : rawType === 'comments' ? 'comment' : rawType;

    const likedPosts = await Post.find({
      status: { $ne: 'removed' },
      likes: userId,
    })
      .select('title author likes updatedAt createdAt')
      .populate('author', 'firstName lastName avatar');

    const commentedPosts = await Post.find({
      status: { $ne: 'removed' },
      'comments.author': userId,
    })
      .select('title author comments likes createdAt')
      .populate('author', 'firstName lastName avatar')
      .populate('comments.author', 'firstName lastName avatar');

    const likes = likedPosts.map((post) => ({
      type: 'like',
      post: {
        _id: post._id,
        title: post.title,
        author: post.author,
        likeCount: post.likes?.length || 0,
      },
      createdAt: post.updatedAt || post.createdAt,
    }));

    const comments = commentedPosts.flatMap((post) => {
      const userComments = (post.comments || []).filter(
        (comment) => comment.author?._id?.toString() === userId.toString()
      );

      return userComments.map((comment) => ({
        type: 'comment',
        post: {
          _id: post._id,
          title: post.title,
          author: post.author,
          likeCount: post.likes?.length || 0,
        },
        comment: {
          _id: comment._id,
          content: comment.content,
        },
        createdAt: comment.createdAt,
      }));
    });

    const timeline = [...likes, ...comments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const filteredTimeline =
      type === 'like' ? timeline.filter((item) => item.type === 'like')
        : type === 'comment' ? timeline.filter((item) => item.type === 'comment')
          : timeline;

    const filteredLikes = type === 'comment' ? [] : likes;
    const filteredComments = type === 'like' ? [] : comments;

    sendResponse(res, 200, {
      likes: filteredLikes,
      comments: filteredComments,
      timeline: filteredTimeline,
    }, 'Activity fetched successfully');
  } catch (error) {
    next(error);
  }
};