import response from '../helpers/response.js';
import problemModels from "../models/problem.models.js";
import {executorCpp} from "../executor/cpp.executor.js";
import {getAllTestCaseFromS3} from "../method/testcase.method.js";
import {executorPython} from "../executor/python.executor.js";

export const submitProblem = async (req, res, next) => {
    try {
        const problemId = req.params.id;
        const { source, submissionId, language } = req.body;
        // const problem = await problemModels.findById(problemId)
        // if (problem == null) {
        //     return response.sendError(res, "Problem not found", 404);
        // }
        let resultFromExecution;
        if (language === 'cpp') {
            resultFromExecution = await executorCpp(submissionId, problemId, source, 10, 3, 256);
        }
        else if (language === 'python') {
            resultFromExecution = await executorPython(submissionId, problemId, source, 10, 3, 256);
        }
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
        const problemVersion = problem._id + (problem.version > 0 ? `-v${problem.version}` : '');
        console.log(problemVersion);
        // await getAllTestCaseFromS3(problem._id, problemVersion);
        let resultFromExecution;
        switch (language) {
            case 'cpp':
                resultFromExecution = await executorCpp(_id, problemVersion, source, problem.numberOfTestCases, problem.time, problem.memory);
                break
                case 'python':
                resultFromExecution = await executorPython(_id, problemVersion, source, problem.numberOfTestCases, problem.time, problem.memory);
                break
            default:
                resultFromExecution = await executorCpp(_id, problemVersion, source, problem.numberOfTestCases, problem.time, problem.memory);
        }
        return resultFromExecution;
    }
    catch (error) {
        console.error(error)
        throw error
    }
}