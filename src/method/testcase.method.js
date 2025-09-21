import {PROBLEM_DIR, S3_INPUT_FILE, S3_OUTPUT_FILE, S3_PROBLEM_PREFIX} from "../utils/Constant.js";
import path from "path";
import fs from "fs-extra";
import {getFile} from "./s3.method.js";

export const getAllTestCaseFromS3 = async (problemId, noOfTestcases) => {
    const problemDir = path.join(PROBLEM_DIR, problemId);
    if (await fs.pathExists(problemDir)) {
        return;
    }
    await fs.mkdirp(problemDir);
    const inputDir = path.join(problemDir, 'inp');
    const outputDir = path.join(problemDir, 'out');
    await fs.mkdirp(inputDir);
    await fs.mkdirp(outputDir);

    // Tạo array các download tasks
    const downloadTasks = [];
    for (let i = 1; i <= noOfTestcases; i++) {
        const outputFileFromS3 = S3_OUTPUT_FILE(problemId, i);
        const inputFileFromS3 = S3_INPUT_FILE(problemId, i);

        downloadTasks.push(
            Promise.all([
                getFile(inputFileFromS3),
                getFile(outputFileFromS3)
            ]).then(([inputData, outputData]) => {
                const inputFilePath = path.join(inputDir, `${problemId}_${i}.inp`);
                const outputFilePath = path.join(outputDir, `${problemId}_${i}.out`);
                return Promise.all([
                    fs.writeFile(inputFilePath, inputData.buffer),
                    fs.writeFile(outputFilePath, outputData.buffer)
                ]);
            })
        );
    }

    // Download tất cả cùng lúc
    await Promise.all(downloadTasks);
}