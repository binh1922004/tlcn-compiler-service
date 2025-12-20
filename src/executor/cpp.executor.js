
import {v4 as uuidv4 }from 'uuid'
import runInContainer from "../docker/compiler.docker.js";
import fs from "fs-extra";
import path from "path";
import {SUBMISSION_DIR} from "../utils/Constant.js";

export const executorCpp = async (submissionId, problemId, source, numberOfTest, time, memory) => {
    const filePath = `${submissionId}/Main.cpp`;
    const buildCmd = `mkdir -p /work/${submissionId} && \
g++ -std=gnu++17 -O2 -pipe -static -s /work/${filePath} \
-o /work/${submissionId}/Main || echo __CE__:$? >&2`;
    source = `#include </work/wrapper.cpp>\n` + source;
    // Compile trong container riêng
    const isBuild = await runInContainer({
        cmd: buildCmd,
        submissionId: submissionId,
        isBuild: true,
        limits: { timeMs: time, memoryMb: memory },
        sourceCode: source,
        language: 'cpp',
    });
    console.log(isBuild);
    console.log(`Source code: ${source}`);
    const res = await runInContainer({
        problemId: problemId,
        cmd: buildCmd,
        submissionId: submissionId,
        noOfTests: numberOfTest,
        limits: { timeMs: time, memoryMb: memory },
        language: 'cpp',
    });
    console.log("Result after run test: ", res);
    fs.removeSync(path.join(SUBMISSION_DIR, submissionId));
    console.log(`Folder ${submissionId} was removed`);
    return res;
}