import response from '../helpers/response.js';
import problemModels from "../models/problem.models.js";
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