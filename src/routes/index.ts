import { Router } from "express";
import { healthRouter } from "./health";
import { documentsRouter } from "./documents";
import { s3Router } from "./s3";
import { searchRouter } from "./search";
import { secureRouter } from "./secure";
import { datasetsRouter } from "./datasets";
import { tokensRouter } from "./tokens";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/search", searchRouter);
apiRouter.use("/s3", s3Router);
apiRouter.use("/secure", secureRouter);
apiRouter.use("/datasets", datasetsRouter);
apiRouter.use("/upload-tokens", tokensRouter);
