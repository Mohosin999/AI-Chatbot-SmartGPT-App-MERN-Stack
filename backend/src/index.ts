import "dotenv/config";
import http from "http";
import app from "./app";
import { connectDB } from "./db";
import { connectRedis } from "./redis";

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const main = async (): Promise<void> => {
  try {
    await connectDB();
    await connectRedis();

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.log("Database Error");
    console.log(error);
  }
};

main();
