
import {v4 as uuidv4 }from 'uuid'
import runInContainer from "../docker/compiler.docker.js";
import fs from "fs-extra";
import path from "path";
import {SUBMISSION_DIR} from "../utils/Constant.js";

export const executorCpp = async (problemId, source, numberOfTest) => {
    const submissionId = uuidv4();
    const filePath = `${submissionId}/Main.cpp`;
    const buildCmd = `mkdir -p /work/${submissionId} && \
g++ -std=gnu++17 -O2 -pipe -static -s /work/${filePath} \
-o /work/${submissionId}/Main || echo __CE__:$? >&2`;

    // Compile trong container riêng
    const isBuild = await runInContainer({
        cmd: buildCmd,
        submissionId: submissionId,
        isBuild: true,
        limits: { timeMs: 2000, memoryMb: 512 },
        sourceCode: source
    });
    // check successful build
    if (isBuild !== true){
        return isBuild;
    }
    const res = await runInContainer({
        problemId: problemId,
        cmd: buildCmd,
        submissionId: submissionId,
        noOfTests: 40,
        limits: { timeMs: 2000, memoryMb: 512 }
    });
    fs.removeSync(path.join(SUBMISSION_DIR, submissionId));
    console.log(`Folder ${submissionId} was removed`);
    return res;
}