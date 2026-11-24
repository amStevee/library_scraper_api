import express from "express";
import scraperRoutes from "./routes/scraper.routes.js";

const router = express.Router();

router.use("/harvest", scraperRoutes);

export default router;
