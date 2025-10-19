import app from "./app.js";
import { config } from "../config/env.js";
import connectDB from '../config/db.js';
import {initPool} from "./docker/pool.docker.js";
import {subscribeForCompiler} from "./service/kafka.service.js";

const startServer = async () => {
    await connectDB()
    app.listen(config.port, () => {
        console.log(`Server running on port ${config.port}`)
    })
    console.log(`Server running on port ${config.port}`)
    await subscribeForCompiler('submission-topic');
}

const initContainerPool = async () => {
    await initPool();
}
initContainerPool();
startServer()