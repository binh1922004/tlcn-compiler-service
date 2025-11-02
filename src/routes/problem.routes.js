import express from 'express';
import {createProblem, updateTestcase} from "../controllers/problem.controller.js";
const router = express.Router()

router.post('/create', createProblem)
router.post('/test-case/pull', updateTestcase)
export default router;