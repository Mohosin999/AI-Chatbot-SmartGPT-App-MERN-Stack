import { UserWithoutPassword } from "./common";

declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword & {
        id: string;
        name: string;
        email: string;
        password?: string;
        customInstructions?: string;
        createdAt?: Date;
        updatedAt?: Date;
      };
    }
  }
}

export {};
