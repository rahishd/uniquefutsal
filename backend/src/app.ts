import "./config/env";
import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import logger from "./config/logger";
import authMiddleware from "./middlewares/auth.middleware";
import errorMiddleware from "./middlewares/error.middleware";
import rateLimitMiddleware from "./middlewares/rateLimit.middleware";
import routes from "./routes";

const app: Express = express();

// Behind Nginx (see deploy/): trust ONE proxy hop so req.ip and the rate limits are per visitor, not one shared bucket for everyone.
app.set("trust proxy", 1);

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin images/PDFs
})); // Security

// Serve static files from uploads directory
import path from "path";
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));



const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like curl, mobile apps, postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // if using cookies/auth
  })
);

app.use(morgan("dev")); // Logging
app.use(express.json({ limit: "20mb" })); // Parse JSON with increased limit
app.use(express.urlencoded({ extended: true, limit: "20mb" })); // Parse URL encoded data with increased limit

// Rate limiting
app.use("/api/", rateLimitMiddleware);

// Routes
app.use("/api", routes);

// Error handling middleware (must be last)
app.use(errorMiddleware);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: "Route not found",
  });
});

export default app;
