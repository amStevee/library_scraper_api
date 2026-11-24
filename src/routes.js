import express from "express";
import scraperRoutes from "./api/v2/routes/scraper.routes.js";

const router = express.Router();

router.use("/harvest", scraperRoutes);

export default router;
