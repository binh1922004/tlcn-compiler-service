import response from '../helpers/response.js';
import problemModels from "../models/problem.models.js";
import {executorCpp} from "../executor/cpp.executor.js";
import {getAllTestCaseFromS3} from "../method/testcase.method.js";

export const submitProblem = async (req, res, next) => {
    try {
        const problemId = req.params.id;
        const { source } = req.body;
        // const problem = await problemModels.findById(problemId)
        // if (problem == null) {
        //     return response.sendError(res, "Problem not found", 404);
        // }
        const resultFromExecution = await executorCpp('hehe', problemId, source, 20)
        return response.sendSuccess(res, resultFromExecution);
    }
    catch (error) {
        console.error(error)
        next(error)
    }
}

export const submitProblemFromKafka = async(data) => {
    try {
        const { problem, _id, language, source } = data;
        let resultFromExecution;
        switch (language) {
            case 'cpp':
                resultFromExecution = await executorCpp(_id, problem._id, source, problem.numberOfTestCases, problem.time, problem.memory);
                break
            default:
                resultFromExecution = await executorCpp(_id, problem._id, source, problem.numberOfTestCases, problem.time, problem.memory);
        }
        return resultFromExecution;
    }
    catch (error) {
        console.error(error)
        throw error
    }
}