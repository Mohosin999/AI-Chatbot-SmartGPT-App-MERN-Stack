export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  password?: string | null;
  customInstructions?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserDoc {
  _doc: User;
  id: string;
  name: string;
  email: string;
  password?: string | null;
  customInstructions?: string;
}

export interface UserWithoutPassword {
  id: string;
  name: string;
  email: string;
  customInstructions?: string;
}
