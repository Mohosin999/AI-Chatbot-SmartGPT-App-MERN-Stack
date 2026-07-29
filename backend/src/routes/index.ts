import { Router } from "express";
import authenticate from "../middlewares/authenticate";
import authenticateRefresh from "../middlewares/authenticateRefresh";
import { controllers as authController } from "../api/v1/auth";
import { controllers as chatController } from "../api/v1/chat";
import { controllers as messageController } from "../api/v1/message";
import { controllers as userController } from "../api/v1/user";
import { aiLimiter, authLimiter } from "../middlewares/rateLimiter";

const router = Router();

router
  .post("/api/v1/auth/register", authLimiter, authController.register)
  .post("/api/v1/auth/login", authLimiter, authController.login)
  .post("/api/v1/auth/google", authLimiter, authController.googleLogin)
  .post("/api/v1/auth/logout", authenticate, authController.logout)
  .post(
    "/api/v1/auth/refresh",
    authenticateRefresh,
    authController.refreshToken,
  );

router
  .route("/api/v1/chats")
  .get(authenticate, chatController.findAllItems)
  .post(authenticate, chatController.create)
  .delete(authenticate, chatController.removeAllItems);

router
  .route("/api/v1/chats/:id")
  .get(authenticate, chatController.findSingleItem)
  .patch(authenticate, chatController.updateItem)
  .delete(authenticate, chatController.removeItem);

router.post(
  "/api/v1/messages/stream",
  authenticate,
  aiLimiter,
  messageController.streamCreate,
);

router.post(
  "/api/v1/messages/stream/edit",
  authenticate,
  aiLimiter,
  messageController.streamEdit,
);

router
  .get("/api/v1/user", authenticate, userController.getUser)
  .patch("/api/v1/user", authenticate, userController.updateMe)
  .patch("/api/v1/user/name", authenticate, userController.updateName)
  .delete("/api/v1/user", authenticate, userController.deleteAccount);

export default router;
