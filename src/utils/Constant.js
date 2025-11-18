import path from "path";

export const SUBMISSION_DIR = path.join(process.cwd(), 'oj');
export const PROBLEM_DIR = path.join(process.cwd(), 'problems');
export const S3_PROBLEM_PREFIX = (problemId) => `problems/${problemId}`;
export const S3_INPUT_FILE = (problemId, testId) => `problems/${problemId}/inp/${problemId}_${testId}.inp`;
export const S3_OUTPUT_FILE = (problemId, testId) => `problems/${problemId}/out/${problemId}_${testId}.out`;
