import Docker from 'dockerode';
import { Mutex } from 'async-mutex';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import * as test from "node:test";

const docker = new Docker();
const POOL_SIZE = 5;
const IMAGE = 'oj-cpp:1.0';
const pool = [];
const mutex = new Mutex();
let initializing = false;
const PROBLEMSET_DIR = path.join(process.cwd(), 'problemset');
const SUBMISSION_DIR = path.join(process.cwd(), 'oj');

async function initPool() {
    if (initializing) return;
    initializing = true;
    console.log('Initializing container pool...');

    if (!await fs.pathExists(PROBLEMSET_DIR)) {
        await fs.mkdirp(PROBLEMSET_DIR);
        console.log(`Created problemset directory at ${PROBLEMSET_DIR}`);
    }
    if (!await fs.pathExists(SUBMISSION_DIR)) {
        await fs.mkdirp(SUBMISSION_DIR);
        console.log(`Created submission directory at ${SUBMISSION_DIR}`);
    }

    for (let i = 0; i < POOL_SIZE; i++) {
        try {
            const container = await docker.createContainer({
                Image: IMAGE,
                Tty: false,
                WorkingDir: '/work',
                User: '0:0',
                HostConfig: {
                    NetworkMode: 'none',
                    Memory: 512 * 1024 * 1024,
                    NanoCPUs: 1e9,
                    PidsLimit: 128,
                    ReadonlyRootfs: false,
                    Binds: [`${PROBLEMSET_DIR}:/problems:ro`, `${SUBMISSION_DIR}:/work`],
                    Ulimits: [{ Name: 'fsize', Soft: 1048576 * 50, Hard: 1048576 * 50 }]
                },
                Cmd: ['/bin/bash', '-c', 'sleep infinity']
            });
            await container.start();
            pool.push(container);
            console.log(`Container ${i + 1} created and started.`);
        } catch (err) {
            console.error(`Failed to create container ${i + 1}:`, err);
        }
    }
    initializing = false;
    console.log('Pool initialized with', pool.length, 'containers.');
}

async function getContainerFromPool() {
    const release = await mutex.acquire();
    try {
        if (pool.length > 0) {
            return pool.shift();
        } else {
            console.warn('Pool empty, creating temporary container...');
            const tempContainer = await docker.createContainer({
                Image: IMAGE,
                Tty: false,
                WorkingDir: '/work',
                User: '0:0',
                HostConfig: {
                    NetworkMode: 'none',
                    Memory: 512 * 1024 * 1024,
                    NanoCPUs: 1e9,
                    PidsLimit: 128,
                    ReadonlyRootfs: false,
                    Binds: [`${PROBLEMSET_DIR}:/problems:ro`],
                    Ulimits: [{ Name: 'fsize', Soft: 1048576 * 50, Hard: 1048576 * 50 }]
                },
                Cmd: ['/bin/bash', '-c', 'sleep infinity']
            });
            await tempContainer.start();
            return tempContainer;
        }
    } finally {
        release();
    }
}

async function releaseContainer(container, isTemp = false) {
    const release = await mutex.acquire();
    try {
        // await container.exec({
        //     Cmd: ['/bin/sh', '-c', 'rm -rf /work/*'],
        //     AttachStdout: true,
        //     AttachStderr: true
        // }).then(exec => exec.start({ hijack: false, stdin: false }));

        if (!isTemp) {
            pool.push(container);
        } else {
            await container.stop();
            await container.remove({ force: true });
        }
    } catch (err) {
        console.error('Failed to reset/release container:', err);
        await container.stop().catch(() => {});
        await container.remove({ force: true }).catch(() => {});
    } finally {
        release();
    }
}


export { initPool, getContainerFromPool, releaseContainer, PROBLEMSET_DIR};