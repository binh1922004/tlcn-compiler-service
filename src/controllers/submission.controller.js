import response from '../helpers/response.js';
import problemModels from "../models/problem.models.js";
import {executorCpp} from "../executor/cpp.executor.js";

export const submitProblem = async (req, res, next) => {
    try {
        const problemId = req.params.id;
        const { source } = req.body;
        const problem = await problemModels.findById(problemId)
        if (problem == null) {
            return response.sendError(res, "Problem not found", 404);
        }
        const resultFromExecution = await executorCpp(problemId, source, problem.noOfTest)
        console.log(resultFromExecution);
        return response.sendSuccess(res, resultFromExecution);
    }
    catch (error) {
        console.error(error)
        next(error)
    }
}