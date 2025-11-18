import response from '../helpers/response.js';
import problemModels from "../models/problem.models.js";
import {getAllTestCaseFromS3} from "../method/testcase.method.js";
export const createProblem = async (req, res, next) => {
    try{
        const problem = req.body
        const problemSaved = await problemModels.create(problem)
        return response.sendSuccess(res, problemSaved)
    }
    catch (error) {
        console.log(error)
        next(error)
    }
}

export const updateTestcase = async (req, res, next) => {
    const {problemId, noOfTestcase} = req.body;
    try{
        await getAllTestCaseFromS3(problemId, noOfTestcase);
        return response.sendSuccess(res, 'Update test case successfully');
    }
    catch (error) {
        console.log(error)
        return response.sendError(res, error.message);

    }
}