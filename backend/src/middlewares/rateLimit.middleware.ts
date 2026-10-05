import rateLimit from "express-rate-limit";

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // link each IP to 500 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  skip: () => process.env.NODE_ENV === "test",
});

export const authRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many login attempts, please try again later.",
  skip: () => process.env.NODE_ENV === "test",
});

export default rateLimitMiddleware;
