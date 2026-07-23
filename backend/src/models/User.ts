import { Schema, model, Document } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  email: string;
  password?: string | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: Date | null;
  customInstructions?: string;
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      maxLength: 50,
      minLength: 5,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    refreshToken: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    customInstructions: { type: String, default: "" },
  },
  { timestamps: true, id: true }
);

const User = model<UserDocument>("User", userSchema);

export default User;
