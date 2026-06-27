import { Router } from "express";
import { requireEncryptionKeys } from "../middleware/requireEncryptionKeys";
import { SearchController } from "../controllers/searchController";

export const searchRouter = Router();

searchRouter.get("/", requireEncryptionKeys, SearchController.search);
