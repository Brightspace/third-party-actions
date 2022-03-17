"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const tasklists_1 = require("./tasklists");
const util_1 = require("./util");
const { readFile } = fs_1.promises;
const gitHubEventPath = (0, util_1.requireEnv)('GITHUB_EVENT_PATH');
async function getEventDetails() {
    const event = JSON.parse(await readFile(gitHubEventPath, 'utf8'));
    if (!event.pull_request) {
        (0, core_1.info)('Not a pull_request event. Skipping');
        return;
    }
    const body = event.pull_request.body;
    const repo = event.repository.name;
    const owner = event.repository.owner.login;
    const sha = event.pull_request.head?.sha;
    return { body, repo, owner, sha };
}
async function main() {
    const token = (0, core_1.getInput)('github_token', { required: true });
    const reportTasks = (0, core_1.getInput)('report_tasks') === 'true';
    const octokit = (0, github_1.getOctokit)(token);
    const details = await getEventDetails();
    if (!details) {
        return;
    }
    const { body, repo, owner, sha } = details;
    const danglingTasksNames = new Set();
    if (reportTasks) {
        const existingStatuses = await octokit.rest.repos.listCommitStatusesForRef({ repo, owner, ref: sha });
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
    for (const task of (0, tasklists_1.tasks)((0, tasklists_1.tokenize)(body))) {
        ++totalCount;
        if (task.completed) {
            ++completedCount;
        }
        if (reportTasks) {
            const name = `Tasklists Task: ${task.name}`;
            danglingTasksNames.delete(name);
            statusP.push(octokit.rest.repos.createCommitStatus({
                repo, owner, sha,
                context: name,
                state: task.completed ? 'success' : 'pending',
            }));
        }
    }
    for (const name of danglingTasksNames.values()) {
        statusP.push(octokit.rest.repos.createCommitStatus({
            repo, owner, sha,
            context: name,
            description: 'Removed',
            state: 'error',
        }));
    }
    const completed = completedCount === totalCount;
    statusP.push(octokit.rest.repos.createCommitStatus({
        repo, owner, sha,
        context: 'Tasklists: Completed',
        description: totalCount === 0
            ? 'No tasks'
            : `${completedCount} of ${totalCount} tasks`,
        state: completed ? 'success' : 'pending',
    }));
    await Promise.all(statusP);
}
main().catch((error) => {
    (0, core_1.setFailed)(`Run failed: ${error.message}`);
});
