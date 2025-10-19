import path from "path";
import fs from "fs-extra";
import {getContainerFromPool, PROBLEMSET_DIR, releaseContainer} from "./pool.docker.js";
import {Status} from "../utils/StatusType.js";

async function createFileInContainer(container, content, containerFilePath) {
    // Combine mkdir và create file trong 1 command
    const combinedCmd = `
        mkdir -p $(dirname ${containerFilePath}) && 
        cat > ${containerFilePath} << 'EOF'
${content}
        `;
    try {
        const createFileExec = await container.exec({
            Cmd: ['/bin/sh', '-c', combinedCmd],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await createFileExec.start();
        let output = '', error = '';

        container.modem.demuxStream(stream,
            { write: (data) => output += data.toString() },
            { write: (data) => error += data.toString() }
        );

        await new Promise(resolve => stream.on('end', resolve));
        const result = await createFileExec.inspect();

        if (result.ExitCode !== 0) {
            throw new Error(`Failed to create file: ${error}`);
        }

        return true;

    } catch (error) {
        console.error(`Error creating file in container:`, error);
        throw error;
    }
}

async function buildCode(container, submissionId, cmd, sourceCode) {
    const start = Date.now();
    let stderr = '';
    try {
        // 1. Create source file directly in container
        const containerSourcePath = `/work/${submissionId}/Main.cpp`;
        await createFileInContainer(container, sourceCode, containerSourcePath);

        // Compile
        const compile = await container.exec({
            Cmd: ['/bin/sh', '-lc', cmd],
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: `/work`
        });
        const streamCompile = await compile.start({hijack: false, stdin: false});
        container.modem.demuxStream(streamCompile, {
            write: (data) => {
                stderr += data.toString('utf8');
            }
        }, {
            write: (data) => {
                stderr += data.toString('utf8');
            }
        });
        await new Promise(resolve => streamCompile.on('end', resolve));
        const compileExit = await compile.inspect();
        if (compileExit.ExitCode !== 0 || stderr.includes('__CE__')) {
            return {
                exitCode: compileExit.ExitCode,
                stderr,
                timeMs: Date.now() - start,
                timedOut: false,
                oomKilled: false
            };
        }
    } catch (error) {
        console.error(`Build error for ${submissionId}:`, error);
        return {
            exitCode: 1,
            stderr: `Build error: ${error.message}`,
            timeMs: Date.now() - start,
            timedOut: false,
            oomKilled: false
        };
    }
    return true;
}
// 🔴 FIX 1: Normalize tốt hơn
function normalize(str) {
    return str
        .replace(/\r\n/g, '\n')      // Convert CRLF → LF
        .replace(/\r/g, '\n')         // Convert CR → LF
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)  // Remove empty lines
        .join('\n');
}

// 🔴 FIX 2: Thêm delay để đảm bảo stream xong
async function waitForStream(streamRun) {
    return new Promise((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                resolve();
            }
        });

        streamRun.on('end', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve();
            }
        });

        streamRun.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve();
            }
        });

        streamRun.on('error', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve();
            }
        });
    });
}

function parseStatsFromStderr(stderrData) {
    try {
        // Tìm JSON object trong stderr
        const jsonMatch = stderrData.match(/\{.*"execTimeMs".*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (err) {
        console.error('Error parsing stats JSON:', err.message);
    }

    return {
        execTimeMs: 0,
        peakMemoryKB: 0,
        peakMemoryMB: 0,
        currentMemoryKB: 0,
        currentMemoryMB: 0
    };
}

async function runSingleTest(container, testId, problemId, submissionId, limits, problemDir) {
    const inFile = `${problemDir}/inp/${problemId}_${testId}.inp`;
    const outFile = `${process.cwd()}/problemset/${problemId}/out/${problemId}_${testId}.out`;

    const timeoutSeconds = limits.timeMs;
    const memoryLimitMb = limits.memoryMb || 256;

    const execCmd = `timeout ${timeoutSeconds}s bash -lc 'ulimit -v $((${memoryLimitMb}*1024)); /work/${submissionId}/Main < ${inFile}'`;

    let got = '';
    let testStderr = '';
    let timedOut = false;
    let oomKilled = false;
    let exitCode = 0;
    let execTimeMs = 0;
    let memoryUsedMb = 0;
    const start = Date.now();

    try {
        const execRun = await container.exec({
            Cmd: ['/bin/sh', '-lc', execCmd],
            AttachStdout: true,
            AttachStderr: true,
        });

        const streamRun = await execRun.start({ hijack: false, stdin: false });

        const stdout = [];
        const stderr = [];

        //streaming data and collecting output
        try {
            container.modem.demuxStream(streamRun, {
                write: (data) => {
                    if (data && data.length > 0) {
                        stdout.push(data);
                    }
                },
            }, {
                write: (data) => {
                    if (data && data.length > 0) {
                        stderr.push(data);
                    }
                },
            });
        } catch (err) {
            console.error(`Demux error for test ${testId}:`, err.message);
        }

        const waitPromise = (async () => {
            while (true) {
                try {
                    const inspect = await execRun.inspect();
                    if (!inspect.Running) {
                        return inspect.ExitCode || 0;
                    }
                    const elapsed = (Date.now() - start) / 1000;
                    if (elapsed > timeoutSeconds + 1) {
                        timedOut = true;
                        return 124;
                    }
                    await new Promise(r => setTimeout(r, 50));
                } catch (err) {
                    return -1;
                }
            }
        })();

        exitCode = await Promise.race([
            waitPromise,
            new Promise(resolve => setTimeout(() => resolve(124), (timeoutSeconds + 1) * 1000))
        ]);

        try {
            const finalInspect = await execRun.inspect();
            if (finalInspect.Running) {
                timedOut = true;
                await execRun.kill().catch(() => {});
            }
        } catch (err) {}

        await waitForStream(streamRun, 500);

        try {
            streamRun.destroy();
        } catch (err) {}

        got = Buffer.concat(stdout).toString('utf8');
        testStderr = Buffer.concat(stderr).toString('utf8');

        // 🔴 FIX 2: Parse stats từ stderr
        const stats = parseStatsFromStderr(testStderr);
        execTimeMs = stats.execTimeMs || 0;
        memoryUsedMb = stats.peakMemoryMB || 0;

        const containerState = await container.inspect();
        oomKilled = containerState.State.OOMKilled || false;

        if (memoryUsedMb > memoryLimitMb) {
            oomKilled = true;
        }

        let expected = '';
        try {
            expected = await fs.readFile(outFile, 'utf8');
        } catch (err) {
            console.error(`Cannot read output file ${outFile}:`, err.message);
            return {
                id: testId,
                status: Status.RE,
                execTimeMs: execTimeMs,
                memoryMb: memoryUsedMb,
                truncatedStdout: got.substring(0, 500),
                truncatedStderr: `Cannot read expected output: ${err.message}`,
                timedOut: false,
                oomKilled: false,
                exitCode: -1,
                debug: { got, expected: 'N/A' }
            };
        }

        let status = Status.AC;
        if (timedOut) {
            status = Status.TLE;
        } else if (oomKilled) {
            status = Status.MLE;
        } else if (exitCode !== 0 && exitCode !== 124) {
            status = Status.RE;
        } else {
            const normalizedGot = normalize(got);
            const normalizedExpected = normalize(expected);

            const isMatch = normalizedGot === normalizedExpected;

            if (!isMatch) {
                console.log(`\n❌ TEST ${testId} MISMATCH:`);
                console.log(`Expected (${normalizedExpected.length} chars):`);
                console.log(JSON.stringify(normalizedExpected.substring(0, 200)));
                console.log(`\nGot (${normalizedGot.length} chars):`);
                console.log(JSON.stringify(normalizedGot.substring(0, 200)));
                console.log(`Expected hex:`, Buffer.from(normalizedExpected.substring(0, 50)).toString('hex'));
                console.log(`Got hex:`, Buffer.from(normalizedGot.substring(0, 50)).toString('hex'));
                console.log('---');
            }

            status = isMatch ? Status.AC : Status.WA;
        }

        return {
            id: testId,
            status,
            execTimeMs: execTimeMs,
            memoryMb: memoryUsedMb,
            truncatedStdout: got.substring(0, 500),
            truncatedStderr: testStderr.substring(0, 500),
            timedOut,
            oomKilled,
            exitCode,
            debug: {
                gotLength: got.length,
                expectedLength: expected.length,
                normalizedGotLength: normalize(got).length,
                normalizedExpectedLength: normalize(expected).length,
                execTimeMs: execTimeMs,
                memoryMb: memoryUsedMb,
            }
        };

    } catch (error) {
        console.error(`Fatal error in test ${testId}:`, error.message);
        return {
            id: testId,
            status: Status.RE,
            execTimeMs: 0,
            memoryMb: 0,
            truncatedStdout: '',
            truncatedStderr: error.message,
            timedOut: false,
            oomKilled: false,
            exitCode: -1,
        };
    }
}

async function runCode(problemId, container, submissionId, noOfTests, limits) {
    noOfTests = noOfTests || 0;
    const results = [];
    let passed = 0;
    let maxMemoryMb = 0;
    let maxExecTimeMs = 0;

    const problemDir = `/problems/${problemId}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting ${noOfTests} tests for submission ${submissionId}`);
    console.log(`Time limit: ${limits.timeMs}s | Memory limit: ${limits.memoryMb || 256}MB`);
    console.log(`${'='.repeat(60)}\n`);

    for (let testId = 1; testId <= noOfTests; testId++) {
        const result = await runSingleTest(
            container,
            testId,
            problemId,
            submissionId,
            limits,
            problemDir
        );

        maxMemoryMb = Math.max(maxMemoryMb, result.memoryMb);
        maxExecTimeMs = Math.max(maxExecTimeMs, result.execTimeMs);

        // 🔴 Display với time + memory
        console.log(`Test ${testId}: ${result.status} (${result.execTimeMs}ms, ${result.memoryMb}MB)`);

        if (result.status === Status.AC) {
            passed++;
        }

        results.push(result);

        if (result.status !== Status.AC) {
            console.log(`Test ${testId} failed - stopping execution`);
            break;
        }

        await new Promise(r => setTimeout(r, 100));
    }

    let overall = Status.AC;
    if (results.some(r => r.status === Status.TLE)) {
        overall = Status.TLE;
    } else if (results.some(r => r.status === Status.MLE)) {
        overall = Status.MLE;
    } else if (results.some(r => r.status === Status.RE)) {
        overall = Status.RE;
    } else if (passed < noOfTests) {
        overall = Status.WA;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Result: ${overall} (${passed}/${noOfTests})`);
    console.log(`Max Execution Time: ${maxExecTimeMs}ms`);
    console.log(`Max Memory Used: ${maxMemoryMb}MB`);
    console.log(`${'='.repeat(60)}\n`);

    return {
        exitCode: 0,
        overall,
        passed,
        total: noOfTests,
        time: maxExecTimeMs,  // 🔴 Thêm max time
        memory: maxMemoryMb,
        submissionId,
    };
}

export default async function runInContainer({ problemId, submissionId, isBuild = false, cmd, limits, noOfTests = 10, sourceCode }) {
    const container = await getContainerFromPool();
    try{
        if (isBuild){
            const res = await buildCode(container, submissionId, cmd, sourceCode);
            await releaseContainer(container);
            if (res === true) {
                return true;
            }
            else{
                return res;
            }
        }
        else{
            // const build = await buildCode(container, submissionId, cmd);
            const res = await runCode(problemId, container, submissionId, noOfTests, limits)
            await releaseContainer(container);
            return res;
        }
    }
    catch (error){
        console.error(error);
    }
}

