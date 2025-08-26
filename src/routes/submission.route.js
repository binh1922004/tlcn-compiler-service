import express from 'express';
import {submitProblem} from "../controllers/submission.controller.js";
const router = express.Router()

router.post('/:id/submit', submitProblem)

export default router;