import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import userRoutes from "./routes/userRoutes.js";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH ", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet());

app.use(morgan(process.env.NODE_ENV === "production" ? "cobined" : "dev"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth",userRoutes)
app.use("/api/users", userRoutes);
export default app;