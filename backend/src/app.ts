import express, { Request, Response, NextFunction } from "express";
import applyMiddleware from "./middlewares";
import routes from "./routes";
import { AppError } from "./types/common";

const app = express();

applyMiddleware(app);
app.use(routes);

app.get("/", (_req: Request, res: Response) => {
  res.send("Thinkly ➤ Welcome to Home");
});

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    health: "OK 😍",
    user: req.user,
  });
});

app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  console.log(err);
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});

export default app;
