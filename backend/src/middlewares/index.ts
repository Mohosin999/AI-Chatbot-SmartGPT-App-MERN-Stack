import { Express } from "express";
import cors from "cors";
import morgan from "morgan";
import express from "express";
import { generalLimiter } from "./rateLimiter";

const applyMiddleware = (app: Express): void => {
  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json({ limit: "10mb" }));
  app.use(generalLimiter);
};

export default applyMiddleware;
