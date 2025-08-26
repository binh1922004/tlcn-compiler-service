import path from "path";
import fs from "fs-extra";
import {v4 as uuidv4 }from 'uuid'
import runInContainer from "../docker/compiler.docker.js";
const SUBMISSION_DIR = path.join(process.cwd(), 'oj');

export const executorCpp = async (problemId, source, numberOfTest) => {
    const submissionId = uuidv4();
    const tmpRoot = path.join(SUBMISSION_DIR, submissionId);
    await fs.mkdirp(tmpRoot);




    // Ghi source
    let fileName, buildCmd, runCmd, image;
    image = 'oj-cpp:1.0';
    fileName = 'Main.cpp';
    const filePath = path.join(tmpRoot, 'Main.cpp');
    await fs.writeFile(filePath, source);

    // Kiểm tra file tồn tại trên host để debug
    if (!await fs.pathExists(filePath)) {
        return res.json({status: 'INTERNAL_ERROR', message: 'Failed to write source file on host' });
    }

    buildCmd = `mkdir -p /work/${submissionId} && \
g++ -std=gnu++17 -O2 -pipe -static -s /work/${submissionId}/Main.cpp \
-o /work/${submissionId}/Main || echo __CE__:$? >&2`;

    runCmd = './Main';

    // Compile trong container riêng
    const isBuild = await runInContainer({
        cmd: buildCmd,
        submissionId: submissionId,
        isBuild: true,
        limits: { timeMs: 2000, memoryMb: 512 }
    });
    //
    if (isBuild !== true){
        return isBuild;
    }
    const res = await runInContainer({
        problemId: problemId,
        cmd: buildCmd,
        submissionId: submissionId,
        noOfTests: numberOfTest,
        limits: { timeMs: 2000, memoryMb: 512 }
    });
    return res;
}