import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';
import problemRoutes from "./routes/problem.routes.js";
import submissionRoute from "./routes/submission.route.js";

const app = express();
const docker = new Docker();
const corsOptions = {
    origin: "http://localhost:3000", // chỉ cho phép frontend ở port 3000
    methods: ["GET", "POST"],        // cho phép method nào
    allowedHeaders: ["Content-Type"] // cho phép header nào
};

app.use(cors(corsOptions));



app.use(express.json());
app.use('/problems', problemRoutes);
app.use('/submissions', submissionRoute);
export default app;