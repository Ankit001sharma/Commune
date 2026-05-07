class QueryBuilder {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search', 'q'];
    excludedFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt|ne|in)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  search(fields = ['title', 'description']) {
    if (this.queryString.search || this.queryString.q) {
      const searchTerm = (this.queryString.search || this.queryString.q).trim();
      
      // If searchTerm is multi-word or we want to leverage text index
      // We'll use $text if it's a simple search, otherwise fallback to regex
      if (searchTerm.length > 2) {
        // Option 1: Full text search (requires text index)
        // Option 2: Regex search on specific fields
        
        // For CommuneX, we use a hybrid approach.
        // If we want to prioritize the text index:
        // this.query = this.query.find({ $text: { $search: searchTerm } });
        
        // However, regex is more "fuzzy" for partial matches which users expect in a simple search bar
        const searchRegex = new RegExp(searchTerm, 'i');
        const orConditions = fields.map((field) => ({ [field]: searchRegex }));
        
        // Combine with existing filters
        this.query = this.query.find({ $or: orConditions });
      }
    }
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 20;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit, skip };
    return this;
  }
}

module.exports = QueryBuilder;
