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

    // Only listen when running locally / not on Vercel serverless
    if (!process.env.VERCEL) {
      server.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    } else {
      console.log("Running on Vercel - serverless mode");
    }
  } catch (error) {
    console.log("Database Error");
    console.log(error);
  }
};

main();

// Required for Vercel @vercel/node - must export app/server
export default app;
export { server };
