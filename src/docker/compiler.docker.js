import path from "path";
import fs from "fs-extra";
import {getContainerFromPool, PROBLEMSET_DIR, releaseContainer} from "./pool.docker.js";
async function buildCode(container, submissionId, cmd) {
    const start = Date.now();
    let stderr = '';
    // Compile
    const compile = await container.exec({
        Cmd: ['/bin/sh', '-lc', cmd],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: `/work`
    });
    const streamCompile = await compile.start({ hijack: false, stdin: false });
    container.modem.demuxStream(streamCompile, {
        write: (data) => { stderr += data.toString('utf8'); }
    }, {
        write: (data) => { stderr += data.toString('utf8'); }
    });
    await new Promise(resolve => streamCompile.on('end', resolve));
    const compileExit = await compile.inspect();
    if (compileExit.ExitCode !== 0 || stderr.includes('__CE__')) {
        console.log({ exitCode: compileExit.ExitCode, stdout: '', stderr, timeMs: Date.now() - start, timedOut: false, oomKilled: false })
        return { exitCode: compileExit.ExitCode, stdout: '', stderr, timeMs: Date.now() - start, timedOut: false, oomKilled: false };
    }
    return true;
}

async function runCode(problemId, container, submissionId, noOfTests, limits) {
    noOfTests = noOfTests || 0;
    const results = [];
    let passed = 0;
    let timedOut = false, oomKilled = false;
    const problemDir = `/problems/${problemId}`;
    for (let testId = 1; testId <= noOfTests; testId++) {
        const inFile = `${problemDir}/in/${problemId}_${testId}.in`;
        const outFile = `${process.cwd()}/problemset/${problemId}/out/${problemId}_${testId}.out`;
        const execCmd = `timeout 2s bash -lc 'ulimit -v $((256*1024)); \
/work/${submissionId}/Main < ${inFile}'`;
        const execRun = await container.exec({
            Cmd: ['/bin/sh', '-lc', execCmd],
            AttachStdout: true,
            AttachStderr: true,

        });
        const streamRun = await execRun.start({ hijack: false, stdin: false });
        const start = Date.now();
        let got = '', testStderr = '';
        container.modem.demuxStream(streamRun, {
            write: (data) => { got += data.toString('utf8'); }
        }, {
            write: (data) => { testStderr += data.toString('utf8'); }
        });

        // Chờ process kết thúc hoặc timeout
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('__TIMEOUT__'), limits.timeMs));
        const execWait = (async () => {
            while (true) {
                const inspect = await execRun.inspect();
                if (!inspect.Running) return inspect.ExitCode;
                await new Promise(r => setTimeout(r, 50));
            }
        })();
        const winner = await Promise.race([execWait, timeoutPromise.then(() => '__TIMEOUT__')]);

        if (winner === '__TIMEOUT__') {
            timedOut = true;
            await execRun.kill().catch(() => {});
        }

        const inspect = await container.inspect();
        oomKilled = inspect.State.OOMKilled || false;

        const exitCode = timedOut ? 124 : (winner ?? 0);
        const timeMs = Date.now() - start;


        //read file from test case
        console.log(`Test ${testId}: Got = ${got}`);
        let expected = await fs.readFile(outFile, 'utf8');
        let status = 'OK';
        if (timedOut) status = 'TLE';
        else if (oomKilled) status = 'MLE';
        else if (exitCode !== 0) status = 'RE';
        else {
            got = normalize(got);
            expected = normalize(expected);
            status = (got === expected ? 'OK' : 'WA');
        }

        if (status === 'OK') passed++;
        results.push({
            id: testId,
            status,
            timeMs,
            truncatedStdout: got,
            truncatedStderr: testStderr
        });
    }

    const overall = passed === noOfTests ? 'AC' : (results.find(r => r.status === 'TLE') ? 'TLE' : 'WA');
    return { exitCode: 0, overall, results, passed, total: noOfTests, timedOut, oomKilled };
}

export default async function runInContainer({ problemId, submissionId, isBuild = false, cmd, limits, noOfTests }) {
    const container = await getContainerFromPool();
    try{
        if (isBuild){
            const res = await buildCode(container, submissionId, cmd);
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

function normalize(s) {
    return (s || '').replace(/\r/g, '').trim();
}

function diffLoose(got, exp) {
    // ví dụ: bỏ qua khoảng trắng dư
    return got.split(/\s+/).join(' ') === exp.split(/\s+/).join(' ') ? 'OK' : 'WA';
}
