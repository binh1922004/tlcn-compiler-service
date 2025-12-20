import {PROBLEM_DIR, PROBLEM_DIR_HOST, S3_INPUT_FILE, S3_OUTPUT_FILE, S3_PROBLEM_PREFIX} from "../utils/Constant.js";
import path from "path";
import fs from "fs-extra";
import {getFile} from "./s3.method.js";
import yauzl from 'yauzl';

export const getAllTestCaseFromS3 = async (problemVersion) => {
    const problemId = problemVersion.split('-')[0];
    const problemDir = path.join(PROBLEM_DIR, problemVersion);
    console.log(`Checking problem directory at: ${problemDir}`);
    if ( await fs.pathExists(problemDir)) {
        return true;
    }
    await fs.mkdirp(problemDir);
    const inputDir = path.join(problemDir, 'inp');
    const outputDir = path.join(problemDir, 'out');
    await fs.mkdirp(inputDir);
    await fs.mkdirp(outputDir);

    // Tạo array các download tasks
    // const downloadTasks = [];
    // for (let i = 1; i <= noOfTestcases; i++) {
    //     const outputFileFromS3 = S3_OUTPUT_FILE(problemId, i);
    //     const inputFileFromS3 = S3_INPUT_FILE(problemId, i);
    //
    //     downloadTasks.push(
    //         Promise.all([
    //             getFile(inputFileFromS3),
    //             getFile(outputFileFromS3)
    //         ]).then(([inputData, outputData]) => {
    //             const inputFilePath = path.join(inputDir, `${problemId}_${i}.inp`);
    //             const outputFilePath = path.join(outputDir, `${problemId}_${i}.out`);
    //             return Promise.all([
    //                 fs.writeFile(inputFilePath, inputData.buffer),
    //                 fs.writeFile(outputFilePath, outputData.buffer)
    //             ]);
    //         })
    //     );
    // }
    //
    // // Download tất cả cùng lúc
    // await Promise.all(downloadTasks);
    const zipFileFromS3 = S3_PROBLEM_PREFIX(problemId) + `/${problemVersion}.zip`;

    const zipBuffer = await getFile(zipFileFromS3);
    if (zipBuffer === false) {
        console.log(`Problem zip file not found in S3: ${zipFileFromS3}`);
        return false;
    }
    // console.log(`Problem zip file found in S3: ${zipBuffer}`);
    await unzipAndSave(zipBuffer.buffer, problemDir);
    return false;
}

const unzipAndSave = async (zipBuffer, problemDir) => {
    return new Promise((resolve) => {
        const validation = {
            isValid: true,
            errors: [],
            folderCount: 0,
            filesByFolder: new Map(),
            skippedFiles: [] // Track skipped macOS files
        };
        const savingTask = [];

        yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                validation.isValid = false;
                validation.errors.push(`Cannot read ZIP file: ${err.message}`);
                return resolve(validation);
            }

            zipfile.readEntry();

            zipfile.on('entry', (entry) => {
                const fileName = entry.fileName;
                // // Skip directories
                if (!fileName.endsWith('out') && !fileName.endsWith('inp')) {
                    zipfile.readEntry();
                    console.log('File name: ', fileName);
                    return;
                }
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err){
                        console.error(`Error reading ${fileName}:`, err);
                        zipfile.readEntry();
                        return;
                    }
                    const chunks = [];
                    readStream.on('data', chunk => chunks.push(chunk));
                    readStream.on('end', () => {
                        const fileBuffer = Buffer.concat(chunks);
                        const task = fs.writeFile(path.join(problemDir, fileName), fileBuffer)
                        savingTask.push(task);
                    })

                    readStream.on('error', (error) => {
                        console.error(`Error reading stream for ${fileName}:`, error);
                        zipfile.readEntry();
                    });

                })

                zipfile.readEntry();
            });

            zipfile.on('end', async () => {
                await Promise.all(savingTask);
                resolve(zipfile);
            });

            zipfile.on('error', (error) => {
                validation.isValid = false;
                validation.errors.push(`ZIP reading error: ${error.message}`);
                resolve(validation);
            });
        });
    });
}


export const checkProblemPath = async  (container, problemId) => {
    const check = await getAllTestCaseFromS3(problemId);
    if (check === false){
        console.log(`Problem with ${problemId} not found`);
        await refreshMountCache(container, problemId);
    }
}


async function refreshMountCache(container, problemId) {
    try {
        // Method 1: Access the directory to trigger kernel refresh
        const exec = await container.exec({
            Cmd: ['/bin/sh', '-c', `find /problems/${problemId} -type f > /dev/null 2>&1 || true`],
            AttachStdout: false,
            AttachStderr: false
        });

        await exec.start({ hijack: false, stdin: false });

        // Wait for cache refresh
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log(`[CACHE] Refreshed mount cache for ${problemId}`);
    } catch (err) {
        console.warn(`[CACHE WARNING] Failed to refresh cache:`, err.message);
    }
}
