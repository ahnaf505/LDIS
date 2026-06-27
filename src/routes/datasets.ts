import { Router } from "express";
import { requireEncryptionKeys } from "../middleware/requireEncryptionKeys";
import { DatasetsController } from "../controllers/datasetsController";

export const datasetsRouter = Router();

datasetsRouter.get("/", requireEncryptionKeys, DatasetsController.list);
datasetsRouter.delete("/:id", DatasetsController.delete);
