import { Router } from "express";
import { requireEncryptionKeys } from "../middleware/requireEncryptionKeys";
import { DocumentsController } from "../controllers/documentsController";

export const documentsRouter = Router();

documentsRouter.get("/", requireEncryptionKeys, DocumentsController.getById);
