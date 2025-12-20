import runInContainer from "../docker/compiler.docker.js";
import path from "path";
import {SUBMISSION_DIR} from "../utils/Constant.js";

export const executorPython = async (submissionId, problemId, source, numberOfTest, time, memory) => {
    const isBuild = await runInContainer({
        submissionId: submissionId,
        isBuild: true,
        limits: { timeMs: time, memoryMb: memory },
        sourceCode: source,
        language: 'python',
    });
    console.log(isBuild);
    console.log(`Source code: ${source}`);
    const res = await runInContainer({
        problemId: problemId,
        submissionId: submissionId,
        noOfTests: numberOfTest,
        limits: { timeMs: time, memoryMb: memory },
        language: 'python',
    });
    console.log("Result after run test: ", res);
    // fs.removeSync(path.join(SUBMISSION_DIR, submissionId));
    console.log(`Folder ${submissionId} was removed`);
    return res;
}