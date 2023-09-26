#!/usr/bin/env node
// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const uuid = require("uuid/v4");
const cp = require("child_process");
const cb = require("./code-build");
const assert = require("assert");
const yargs = require("yargs");

const {
  projectName,
  buildspecOverride,
  computeTypeOverride,
  environmentTypeOverride,
  imageOverride,
  imagePullCredentialsTypeOverride,
  envPassthrough,
  remote,
  updateInterval,
  updateBackOff,
} = yargs
  .option("project-name", {
    alias: "p",
    describe: "AWS CodeBuild Project Name",
    demandOption: true,
    type: "string",
  })
  .option("buildspec-override", {
    alias: "b",
    describe: "Path to buildspec file",
    type: "string",
  })
  .option("compute-type-override", {
    alias: "c",
    describe:
      "The name of a compute type for this build that overrides the one specified in the build project.",
    type: "string",
  })
  .option("environment-type-override", {
    alias: "et",
    describe:
      "A container type for this build that overrides the one specified in the build project.",
    type: "string",
  })
  .option("image-override", {
    alias: "i",
    describe:
      "The type of credentials CodeBuild uses to pull images in your build.",
    type: "string",
  })
  .option("image-pull-credentials-type-override", {
    alias: "it",
    describe:
      "The name of an image for this build that overrides the one specified in the build project.",
    choices: ["CODEBUILD", "SERVICE_ROLE"],
  })
  .option("env-vars-for-codebuild", {
    alias: "e",
    describe: "List of environment variables to send to CodeBuild",
    type: "array",
  })
  .option("remote", {
    alias: "r",
    describe: "remote name to publish to",
    default: "origin",
    type: "string",
  })
  .option("update-interval", {
    describe: "Interval in seconds between API calls for fetching updates",
    default: 30,
    type: "number",
  })
  .option("update-backoff", {
    describe:
      "Base update interval back-off value when encountering API rate-limiting",
    default: 15,
    type: "number",
  }).argv;

const BRANCH_NAME = uuid();

const params = cb.inputs2Parameters({
  projectName,
  ...githubInfo(remote),
  sourceVersion: BRANCH_NAME,
  buildspecOverride,
  computeTypeOverride,
  environmentTypeOverride,
  imageOverride,
  imagePullCredentialsTypeOverride,
  envPassthrough,
});

const config = {
  updateInterval: updateInterval * 1000,
  updateBackOff: updateBackOff * 1000,
};

const sdk = cb.buildSdk();

pushBranch(remote, BRANCH_NAME);

cb.build(sdk, params, config)
  .then(() => deleteBranch(remote, BRANCH_NAME))
  .catch((err) => {
    deleteBranch(remote, BRANCH_NAME);
    throw err;
  });

function pushBranch(remote, branchName) {
  cp.execSync(`git push ${remote} HEAD:${branchName}`);
}

function deleteBranch(remote, branchName) {
  cp.execSync(`git push ${remote} :${branchName}`);
}

function githubInfo(remote) {
  const gitHubSSH = "git@github.com:";
  const gitHubHTTPS = "https://github.com/";
  /* Expecting to match something like:
   * 'fork    git@github.com:seebees/aws-codebuild-run-build.git (push)'
   * Which is the output of `git remote -v`
   */
  const remoteMatch = new RegExp(`^${remote}.*\\(push\\)$`);
  /* Not doing a grep because then I have to pass user input to the shell.
   * This way I don't have to worry about sanitizing and injection and all that jazz.
   * Further, when I _do_ pass the remote into the shell to push to it,
   * given that I find it in the remote list,
   * I feel confident that there are no shinanaigans.
   */
  const [gitRemote] = cp
    .execSync("git remote -v")
    .toString()
    .split("\n")
    .filter((line) => line.trim().match(remoteMatch));
  assert(gitRemote, `No remote found named ${remote}`);
  const [, url] = gitRemote.split(/[\t ]/);
  if (url.startsWith(gitHubHTTPS)) {
    const [owner, repo] = url.slice(gitHubHTTPS.length, -4).split("/");
    return { owner, repo };
  } else if (url.startsWith(gitHubSSH)) {
    const [owner, repo] = url.slice(gitHubSSH.length, -4).split("/");
    return { owner, repo };
  } else {
    throw new Error(`Unsupported format: ${url}`);
  }
}
