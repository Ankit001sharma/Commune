const sendResponse = (res, statusCode, data, message = 'Success') => {
  const response = {
    status: 'success',
    message,
  };

  if (data !== undefined && data !== null) {
    if (Array.isArray(data)) {
      response.count = data.length;
      response.data = data;
    } else {
      response.data = data;
    }
  }

  return res.status(statusCode).json(response);
};

const sendPaginatedResponse = (res, statusCode, data, pagination, message = 'Success') => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    count: data.length,
    pagination,
    data,
  });
};

module.exports = { sendResponse, sendPaginatedResponse };
