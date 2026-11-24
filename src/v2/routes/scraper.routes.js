import express from "express";
import scraperController from "../controllers/scraper.controller.js";

const router = express.Router();

router.post("/", scraperController);

export default router;
