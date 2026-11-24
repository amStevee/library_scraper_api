import helmet from "helmet";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import rateLimit from "express-rate-limit";
import v2Routes from "./routes.js";
const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use(helmet());
app.use(morgan("dev"));
app.use(limiter);
app.use(cors());
app.use(express.json());

app.use("/api/v2", v2Routes);

app.get("/health", (_, res) => {
  res.status(200).json({ success: true });
});

export default app;
