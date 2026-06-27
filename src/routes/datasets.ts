import { Router } from "express";
import { requireEncryptionKeys } from "../middleware/requireEncryptionKeys";
import { DatasetsController } from "../controllers/datasetsController";

export const datasetsRouter = Router();

datasetsRouter.get("/", requireEncryptionKeys, DatasetsController.list);
datasetsRouter.post("/", DatasetsController.create);
datasetsRouter.get("/:bucket/files", DatasetsController.files);
datasetsRouter.delete("/:id", DatasetsController.delete);
