const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      maxlength: 1000,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      maxlength: 5000,
    },
    type: {
      type: String,
      required: true,
      enum: ['announcement', 'lost-found', 'discussion', 'campus-update', 'question'],
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    images: [
      {
        url: { type: String },
        thumbnail: { type: String },
      },
    ],
    tags: [{ type: String, lowercase: true, trim: true }],
    comments: [commentSchema],
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPinned: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'closed', 'removed'],
      default: 'active',
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.index({ title: 'text', content: 'text', tags: 'text' });
postSchema.index({ type: 1, status: 1 });
postSchema.index({ createdAt: -1 });

postSchema.virtual('commentCount').get(function () {
  return this.comments ? this.comments.length : 0;
});

postSchema.virtual('likeCount').get(function () {
  return this.likes ? this.likes.length : 0;
});

module.exports = mongoose.model('Post', postSchema);
