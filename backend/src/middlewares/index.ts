import { Express } from "express";
import cors from "cors";
import morgan from "morgan";
import express from "express";

const applyMiddleware = (app: Express): void => {
  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
};

export default applyMiddleware;
