const Post = require('../models/Post');
const AppError = require('../utils/AppError');
const { sendResponse, sendPaginatedResponse } = require('../utils/response');
const QueryBuilder = require('../utils/QueryBuilder');

exports.createPost = async (req, res, next) => {
  try {
    const postData = {
      ...req.body,
      author: req.user._id,
    };

    if (req.files && req.files.length > 0) {
      postData.images = req.files.map((file) => ({
        url: `/uploads/${file.filename}`,
        thumbnail: `/uploads/${file.filename}`,
      }));
    }

    if (req.body.tags && typeof req.body.tags === 'string') {
      postData.tags = req.body.tags.split(',').map((t) => t.trim().toLowerCase());
    }

    const post = await Post.create(postData);
    await post.populate('author', 'firstName lastName avatar');

    sendResponse(res, 201, post, 'Post created successfully');
  } catch (error) {
    next(error);
  }
};

exports.getPosts = async (req, res, next) => {
  try {
    const filter = { status: { $ne: 'removed' } };
    if (req.query.type) filter.type = req.query.type;

    const queryBuilder = new QueryBuilder(Post.find(filter), req.query)
      .search(['title', 'content', 'tags'])
      .sort()
      .paginate();

    const posts = await queryBuilder.query
      .populate('author', 'firstName lastName avatar')
      .populate('comments.author', 'firstName lastName avatar');

    const total = await Post.countDocuments(filter);

    sendPaginatedResponse(res, 200, posts, {
      ...queryBuilder.pagination,
      total,
      pages: Math.ceil(total / (queryBuilder.pagination?.limit || 20)),
    });
  } catch (error) {
    next(error);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'firstName lastName avatar')
      .populate('comments.author', 'firstName lastName avatar');

    if (!post) return next(new AppError('Post not found.', 404));

    post.views += 1;
    await post.save({ validateBeforeSave: false });

    sendResponse(res, 200, post);
  } catch (error) {
    next(error);
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new AppError('Post not found.', 404));

    if (post.author.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only edit your own posts.', 403));
    }

    const allowedFields = ['title', 'content', 'type', 'tags', 'status'];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const updated = await Post.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('author', 'firstName lastName avatar')
      .populate('comments.author', 'firstName lastName avatar');

    sendResponse(res, 200, updated, 'Post updated successfully');
  } catch (error) {
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new AppError('Post not found.', 404));

    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return next(new AppError('You can only delete your own posts.', 403));
    }

    post.status = 'removed';
    await post.save({ validateBeforeSave: false });

    sendResponse(res, 200, null, 'Post removed successfully');
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new AppError('Post not found.', 404));

    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return next(new AppError('Comment content is required.', 400));
    }

    post.comments.push({
      author: req.user._id,
      content: content.trim(),
    });

    await post.save();
    await post.populate('comments.author', 'firstName lastName avatar');

    sendResponse(res, 201, post, 'Comment added successfully');
  } catch (error) {
    next(error);
  }
};

exports.toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new AppError('Post not found.', 404));

    const index = post.likes.indexOf(req.user._id);
    if (index > -1) {
      post.likes.splice(index, 1);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save({ validateBeforeSave: false });

    sendResponse(res, 200, { likes: post.likes.length, liked: index === -1 }, 'Like toggled');
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new AppError('Post not found.', 404));

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return next(new AppError('Comment not found.', 404));

    if (comment.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return next(new AppError('You can only delete your own comments.', 403));
    }

    comment.deleteOne();
    await post.save();

    sendResponse(res, 200, null, 'Comment deleted successfully');
  } catch (error) {
    next(error);
  }
};
