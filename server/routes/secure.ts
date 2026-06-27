import { Router } from "express";
import { requireEncryptionKeys } from "../middleware/requireEncryptionKeys";
import { SecureController } from "../controllers/secureController";

export const secureRouter = Router();

secureRouter.get("/:bucket/*", requireEncryptionKeys, SecureController.stream);
