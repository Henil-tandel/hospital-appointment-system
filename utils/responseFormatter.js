const responseFormat = (success,message,data = null) => {
    return { success, message, data };
}

const errorResponse = (res,statusCode,message) => {
    return res.status(statusCode).json(responseFormat(false,message));
}

const successResponse = (res,statusCode,message,data = null) => {
    return res.status(statusCode).json(responseFormat(true,message,data));
} 

module.exports = { responseFormat , errorResponse , successResponse };