export interface User {
  id: string;
  name: string;
}

export interface ChatObj {
  id: string;
  userId: string;
  name: string;
  userName: string;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}
