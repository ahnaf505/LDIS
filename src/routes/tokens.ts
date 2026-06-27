import { Router } from "express";
import { TokenController } from "../controllers/tokenController";

export const tokensRouter = Router();

tokensRouter.get("/:bucket", TokenController.get);
tokensRouter.post("/:bucket", TokenController.generate);
tokensRouter.delete("/:bucket", TokenController.revoke);
