"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const tasklists_1 = require("./tasklists");
const util_1 = require("./util");
const { readFile } = fs_1.promises;
const GITHUB_EVENT_PATH = util_1.requireEnv('GITHUB_EVENT_PATH');
async function getEventDetails() {
    var _a;
    const event = JSON.parse(await readFile(GITHUB_EVENT_PATH, 'utf8'));
    if (!event.pull_request) {
        core_1.info('Not a pull_request event. Skipping');
        return;
    }
    const body = event.pull_request.body;
    const repo = event.repository.name;
    const owner = event.repository.owner.login;
    const sha = (_a = event.pull_request.head) === null || _a === void 0 ? void 0 : _a.sha;
    return { body, repo, owner, sha };
}
async function main() {
    const token = core_1.getInput('github_token', { required: true });
    const reportTasks = core_1.getInput('report_tasks') === 'true';
    const octokit = github_1.getOctokit(token);
    const details = await getEventDetails();
    if (!details) {
        return;
    }
    const { body, repo, owner, sha } = details;
    const danglingTasksNames = new Set();
    if (reportTasks) {
        const existingStatuses = await octokit.repos.listCommitStatusesForRef({ repo, owner, ref: sha });
        const danglingStatuses = existingStatuses
            .data
            .map((item) => item.context)
            .filter(name => name.startsWith('Tasklists Task:'));
        for (const danglingStatus of danglingStatuses) {
            danglingTasksNames.add(danglingStatus);
        }
    }
    const statusP = [];
    let completedCount = 0;
    let totalCount = 0;
    for (const task of tasklists_1.tasks(tasklists_1.tokenize(body))) {
        ++totalCount;
        if (task.completed) {
            ++completedCount;
        }
        if (reportTasks) {
            const name = `Tasklists Task: ${task.name}`;
            danglingTasksNames.delete(name);
            statusP.push(octokit.repos.createCommitStatus({
                repo, owner, sha,
                context: name,
                state: task.completed ? 'success' : 'pending'
            }));
        }
    }
    for (const name of danglingTasksNames.values()) {
        statusP.push(octokit.repos.createCommitStatus({
            repo, owner, sha,
            context: name,
            description: 'Removed',
            state: 'error'
        }));
    }
    const completed = completedCount === totalCount;
    statusP.push(octokit.repos.createCommitStatus({
        repo, owner, sha,
        context: 'Tasklists: Completed',
        description: totalCount === 0 ?
            'No tasks' :
            `${completedCount} of ${totalCount} tasks`,
        state: completed ? 'success' : 'pending'
    }));
    await Promise.all(statusP);
}
main().catch((error) => {
    core_1.setFailed(`Run failed: ${error.message}`);
});
