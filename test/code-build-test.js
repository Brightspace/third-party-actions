// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const {
  logName,
  githubInputs,
  inputs2Parameters,
  waitForBuildEndTime,
  buildSdk,
} = require("../code-build");
const { expect } = require("chai");
const forEach = require("mocha-each");

describe("logName", () => {
  it("return the logGroupName and logStreamName from an ARN", () => {
    const arn =
      "arn:aws:logs:us-west-2:111122223333:log-group:/aws/codebuild/CloudWatchLogGroup:log-stream:1234abcd-12ab-34cd-56ef-1234567890ab";
    const test = logName(arn);
    expect(test)
      .to.haveOwnProperty("logGroupName")
      .and.to.equal("/aws/codebuild/CloudWatchLogGroup");
    expect(test)
      .to.haveOwnProperty("logStreamName")
      .and.to.equal("1234abcd-12ab-34cd-56ef-1234567890ab");
  });

  it("return undefined when the group and stream are null", () => {
    const arn =
      "arn:aws:logs:us-west-2:111122223333:log-group:null:log-stream:null";
    const test = logName(arn);
    expect(test).to.haveOwnProperty("logGroupName").and.to.equal(undefined);
    expect(test).to.haveOwnProperty("logStreamName").and.to.equal(undefined);
  });

  it("return undefined when the Arn is undefined", () => {
    const arn = undefined;
    const test = logName(arn);
    expect(test).to.haveOwnProperty("logGroupName").and.to.equal(undefined);
    expect(test).to.haveOwnProperty("logStreamName").and.to.equal(undefined);
  });
});

describe("githubInputs", () => {
  const OLD_ENV = { ...process.env };
  const { context: OLD_CONTEXT } = require("@actions/github");
  const { payload: OLD_PAYLOAD, eventName: OLD_EVENT_NAME } = OLD_CONTEXT;
  afterEach(() => {
    process.env = { ...OLD_ENV };
    const { context } = require("@actions/github");
    context.eventName = OLD_EVENT_NAME;
    context.payload = OLD_PAYLOAD;
  });

  const projectName = "project_name";
  const repoInfo = "owner/repo";
  const sha = "1234abcd-12ab-34cd-56ef-1234567890ab";
  const pullRequestSha = "181600acb3cfb803f4570d0018928be5d730c00d";

  const updateInterval = 5;
  const updateBackOff = 10;

  it("build basic parameters for codeBuild.startBuild", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    // These tests run in pull requests
    // so to tests things that are NOT pull request...
    process.env[`GITHUB_EVENT_NAME`] = "not_pull_request";
    const test = githubInputs();
    expect(test).to.haveOwnProperty("projectName").and.to.equal(projectName);
    expect(test).to.haveOwnProperty("sourceVersion").and.to.equal(sha);
    expect(test).to.haveOwnProperty("owner").and.to.equal(`owner`);
    expect(test).to.haveOwnProperty("repo").and.to.equal(`repo`);
    expect(test)
      .to.haveOwnProperty("buildspecOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("computeTypeOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("environmentTypeOverride")
      .and.to.equal(undefined);
    expect(test).to.haveOwnProperty("imageOverride").and.to.equal(undefined);
    expect(test).to.haveOwnProperty("envPassthrough").and.to.deep.equal([]);
    expect(test).to.haveOwnProperty("hideCloudWatchLogs").and.to.equal(false);
    expect(test).to.haveOwnProperty("disableGithubEnvVars").and.to.equal(false);
  });

  it("a project name is required.", () => {
    expect(() => githubInputs()).to.throw();
  });

  it("can process env-vars-for-codebuild", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;

    process.env[`INPUT_ENV-VARS-FOR-CODEBUILD`] = `one, two 
    , three,
    four    `;

    process.env.one = "_one_";
    process.env.two = "_two_";
    process.env.three = "_three_";
    process.env.four = "_four_";

    const test = githubInputs();

    expect(test)
      .to.haveOwnProperty("envPassthrough")
      .and.to.deep.equal(["one", "two", "three", "four"]);
  });

  it("skips override when parameter is set to true", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`INPUT_DISABLE-SOURCE-OVERRIDE`] = "true";
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;

    const test = githubInputs();

    expect(test)
      .to.haveOwnProperty("disableSourceOverride")
      .and.to.deep.equal(true);
  });

  it("can handle pull requests", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    process.env[`GITHUB_EVENT_NAME`] = "pull_request";
    const { context } = require("@actions/github");
    context.payload = { pull_request: { head: { sha: pullRequestSha } } };
    const test = githubInputs();
    expect(test).to.haveOwnProperty("projectName").and.to.equal(projectName);
    expect(test)
      .to.haveOwnProperty("sourceVersion")
      .and.to.equal(pullRequestSha);
    expect(test).to.haveOwnProperty("owner").and.to.equal(`owner`);
    expect(test).to.haveOwnProperty("repo").and.to.equal(`repo`);
    expect(test)
      .to.haveOwnProperty("buildspecOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("computeTypeOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("environmentTypeOverride")
      .and.to.equal(undefined);
    expect(test).to.haveOwnProperty("imageOverride").and.to.equal(undefined);
    expect(test).to.haveOwnProperty("envPassthrough").and.to.deep.equal([]);
  });

  it("will not continue if there is no payload", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    process.env[`GITHUB_EVENT_NAME`] = "pull_request";
    // These tests run in pull requests
    // so to tests things that are NOT pull request...
    require("@actions/github").context.payload = {};

    expect(() => githubInputs()).to.throw(
      "No source version could be evaluated."
    );
  });

  it("can handle configuring update call-rate", () => {
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`INPUT_UPDATE-INTERVAL`] = `${updateInterval}`;
    process.env[`INPUT_UPDATE-BACK-OFF`] = `${updateBackOff}`;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    const { context } = require("@actions/github");
    context.payload = { pull_request: { head: { sha: pullRequestSha } } };

    const test = githubInputs();

    expect(test)
      .to.haveOwnProperty("updateInterval")
      .and.to.equal(updateInterval * 1000);
    expect(test)
      .to.haveOwnProperty("updateBackOff")
      .and.to.equal(updateBackOff * 1000);
  });

  it("can hide cloudwatch logs when the parameter is set to true", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`INPUT_HIDE-CLOUDWATCH-LOGS`] = "true";
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;

    const test = githubInputs();

    expect(test).to.haveOwnProperty("hideCloudWatchLogs").and.to.equal(true);
  });
});

describe("inputs2Parameters", () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  const projectName = "project_name";
  const repoInfo = "owner/repo";
  const sha = "1234abcd-12ab-34cd-56ef-1234567890ab";

  it("build basic parameters for codeBuild.startBuild", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    const test = inputs2Parameters({
      projectName,
      sourceVersion: sha,
      owner: "owner",
      repo: "repo",
    });
    expect(test).to.haveOwnProperty("projectName").and.to.equal(projectName);
    expect(test).to.haveOwnProperty("sourceVersion").and.to.equal(sha);
    expect(test)
      .to.haveOwnProperty("sourceTypeOverride")
      .and.to.equal("GITHUB");
    expect(test)
      .to.haveOwnProperty("sourceLocationOverride")
      .and.to.equal(`https://github.com/owner/repo.git`);
    expect(test)
      .to.haveOwnProperty("buildspecOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("computeTypeOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("environmentTypeOverride")
      .and.to.equal(undefined);
    expect(test).to.haveOwnProperty("imageOverride").and.to.equal(undefined);

    // I send everything that starts 'GITHUB_'
    expect(test)
      .to.haveOwnProperty("environmentVariablesOverride")
      .and.to.have.lengthOf.greaterThan(1);

    const [repoEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_REPOSITORY"
    );
    expect(repoEnv)
      .to.haveOwnProperty("name")
      .and.to.equal("GITHUB_REPOSITORY");
    expect(repoEnv).to.haveOwnProperty("value").and.to.equal(repoInfo);
    expect(repoEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");

    const [shaEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_SHA"
    );
    expect(shaEnv).to.haveOwnProperty("name").and.to.equal("GITHUB_SHA");
    expect(shaEnv).to.haveOwnProperty("value").and.to.equal(sha);
    expect(shaEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");
  });

  it("build override parameters for codeBuild.startBuild", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;
    const test = inputs2Parameters({
      projectName,
      sourceVersion: sha,
      owner: "owner",
      repo: "repo",
      computeTypeOverride: "BUILD_GENERAL1_LARGE",
      environmentTypeOverride: "LINUX_CONTAINER",
      imageOverride:
        "111122223333.dkr.ecr.us-west-2.amazonaws.com/codebuild-docker-repo",
    });
    expect(test).to.haveOwnProperty("projectName").and.to.equal(projectName);
    expect(test).to.haveOwnProperty("sourceVersion").and.to.equal(sha);
    expect(test)
      .to.haveOwnProperty("sourceTypeOverride")
      .and.to.equal("GITHUB");
    expect(test)
      .to.haveOwnProperty("sourceLocationOverride")
      .and.to.equal(`https://github.com/owner/repo.git`);
    expect(test)
      .to.haveOwnProperty("buildspecOverride")
      .and.to.equal(undefined);
    expect(test)
      .to.haveOwnProperty("computeTypeOverride")
      .and.to.equal(`BUILD_GENERAL1_LARGE`);
    expect(test)
      .to.haveOwnProperty("environmentTypeOverride")
      .and.to.equal(`LINUX_CONTAINER`);
    expect(test)
      .to.haveOwnProperty("imageOverride")
      .and.to.equal(
        `111122223333.dkr.ecr.us-west-2.amazonaws.com/codebuild-docker-repo`
      );

    // I send everything that starts 'GITHUB_'
    expect(test)
      .to.haveOwnProperty("environmentVariablesOverride")
      .and.to.have.lengthOf.greaterThan(1);

    const [repoEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_REPOSITORY"
    );
    expect(repoEnv)
      .to.haveOwnProperty("name")
      .and.to.equal("GITHUB_REPOSITORY");
    expect(repoEnv).to.haveOwnProperty("value").and.to.equal(repoInfo);
    expect(repoEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");

    const [shaEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_SHA"
    );
    expect(shaEnv).to.haveOwnProperty("name").and.to.equal("GITHUB_SHA");
    expect(shaEnv).to.haveOwnProperty("value").and.to.equal(sha);
    expect(shaEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");
  });

  it("can process env-vars-for-codebuild", () => {
    // This is how GITHUB injects its input values.
    // It would be nice if there was an easy way to test this...
    process.env[`INPUT_PROJECT-NAME`] = projectName;
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;

    process.env[`INPUT_ENV-VARS-FOR-CODEBUILD`] = `one, two 
    , three,
    four    `;

    process.env.one = "_one_";
    process.env.two = "_two_";
    process.env.three = "_three_";
    process.env.four = "_four_";

    const test = inputs2Parameters({
      projectName,
      sourceVersion: sha,
      owner: "owner",
      repo: "repo",
      envPassthrough: ["one", "two", "three", "four"],
    });

    expect(test)
      .to.haveOwnProperty("environmentVariablesOverride")
      .and.to.have.lengthOf.greaterThan(5);

    const [oneEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "one"
    );
    expect(oneEnv).to.haveOwnProperty("name").and.to.equal("one");
    expect(oneEnv).to.haveOwnProperty("value").and.to.equal("_one_");
    expect(oneEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");

    const [twoEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "two"
    );
    expect(twoEnv).to.haveOwnProperty("name").and.to.equal("two");
    expect(twoEnv).to.haveOwnProperty("value").and.to.equal("_two_");
    expect(twoEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");

    const [threeEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "three"
    );
    expect(threeEnv).to.haveOwnProperty("name").and.to.equal("three");
    expect(threeEnv).to.haveOwnProperty("value").and.to.equal("_three_");
    expect(threeEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");

    const [fourEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "four"
    );
    expect(fourEnv).to.haveOwnProperty("name").and.to.equal("four");
    expect(fourEnv).to.haveOwnProperty("value").and.to.equal("_four_");
    expect(fourEnv).to.haveOwnProperty("type").and.to.equal("PLAINTEXT");
  });

  it("can process disable-source-override", () => {
    const test = inputs2Parameters({
      projectName,
      sourceVersion: sha,
      owner: "owner",
      repo: "repo",
      disableSourceOverride: true,
    });
    expect(test).to.not.haveOwnProperty("sourceTypeOverride");
    expect(test).to.not.haveOwnProperty("sourceLocationOverride");
    expect(test).to.not.haveOwnProperty("sourceVersion");
  });

  it("can process disable-github-env-vars", () => {
    process.env[`GITHUB_REPOSITORY`] = repoInfo;
    process.env[`GITHUB_SHA`] = sha;

    const test = inputs2Parameters({
      projectName,
      sourceVersion: sha,
      owner: "owner",
      repo: "repo",
      disableGithubEnvVars: true,
    });

    const [repoEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_REPOSITORY"
    );
    expect(repoEnv).to.equal(undefined);

    const [shaEnv] = test.environmentVariablesOverride.filter(
      ({ name }) => name === "GITHUB_SHA"
    );
    expect(shaEnv).to.equal(undefined);
  });
});

describe("waitForBuildEndTime", () => {
  const defaultConfig = { updateInterval: 10, updateBackOff: 10 }; // NOTE: milliseconds
  it("basic usages", async () => {
    let count = 0;
    const buildID = "buildID";
    const cloudWatchLogsArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:/aws/codebuild/CloudWatchLogGroup:log-stream:1234abcd-12ab-34cd-56ef-1234567890ab";

    const buildReplies = [
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
    ];
    const logReplies = [{ events: [] }];
    const sdk = help(
      () => buildReplies[count - count++],
      () => logReplies[0]
    );

    const test = await waitForBuildEndTime(
      sdk,
      {
        id: buildID,
        logs: { cloudWatchLogsArn },
      },
      defaultConfig
    );

    expect(test).to.equal(buildReplies.pop().builds[0]);
    expect(count).to.equal(2);
  });

  it("waits for a build endTime **and** no cloud watch log events", async function () {
    this.timeout(25000);
    let count = 0;
    const buildID = "buildID";
    const nullArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:null:log-stream:null";
    const cloudWatchLogsArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:/aws/codebuild/CloudWatchLogGroup:log-stream:1234abcd-12ab-34cd-56ef-1234567890ab";

    const buildReplies = [
      { builds: [{ id: buildID, logs: { cloudWatchLogsArn } }] },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
    ];
    const logReplies = [
      undefined,
      { events: [{ message: "got one" }] },
      { events: [] },
      { events: [] },
    ];
    const sdk = help(
      () => buildReplies[count++],
      () => logReplies[count - 1]
    );

    const test = await waitForBuildEndTime(
      sdk,
      {
        id: buildID,
        logs: { cloudWatchLogsArn: nullArn },
      },
      defaultConfig
    );

    expect(test).to.equal(buildReplies.pop().builds[0]);
    expect(count).to.equal(4);
  });

  it("waits after being rate limited and tries again", async function () {
    const buildID = "buildID";
    const nullArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:null:log-stream:null";
    const cloudWatchLogsArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:/aws/codebuild/CloudWatchLogGroup:log-stream:1234abcd-12ab-34cd-56ef-1234567890ab";

    const buildReplies = [
      () => {
        throw { message: "Rate exceeded" };
      },
      { builds: [{ id: buildID, logs: { cloudWatchLogsArn } }] },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
    ];

    const sdk = help(
      () => {
        //similar to the ret function in the helper, allows me to throw an error in a function or return a more standard reply
        let reply = buildReplies.shift();

        if (typeof reply === "function") return reply();
        return reply;
      },
      () => {
        if (buildReplies.length <= 1) {
          return { events: [] };
        }

        return { events: [{ message: "got one" }] };
      }
    );

    const test = await waitForBuildEndTime(
      { ...sdk },
      {
        id: buildID,
        logs: { cloudWatchLogsArn: nullArn },
      },
      { updateInterval: 1, updateBackOff: 1 }
    );

    expect(test.id).to.equal(buildID);
  });

  it("dies after getting an error from the aws sdk that isn't rate limiting", async function () {
    const buildID = "buildID";
    const nullArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:null:log-stream:null";
    const cloudWatchLogsArn =
      "arn:aws:logs:us-west-2:111122223333:log-group:/aws/codebuild/CloudWatchLogGroup:log-stream:1234abcd-12ab-34cd-56ef-1234567890ab";

    const buildReplies = [
      () => {
        throw { message: "Some AWS error" };
      },
      { builds: [{ id: buildID, logs: { cloudWatchLogsArn } }] },
      {
        builds: [
          { id: buildID, logs: { cloudWatchLogsArn }, endTime: "endTime" },
        ],
      },
    ];

    const sdk = help(
      () => {
        //similar to the ret function in the helper
        //allows me to throw an error in a function or return a more standard reply
        let reply = buildReplies.shift();

        if (typeof reply === "function") return reply();
        return reply;
      },
      () => {
        if (!buildReplies.length) {
          return { events: [] };
        }

        return { events: [{ message: "got one" }] };
      }
    );

    //run the thing and it should fail
    let didFail = false;

    try {
      await waitForBuildEndTime(
        { ...sdk },
        {
          id: buildID,
          logs: { cloudWatchLogsArn: nullArn },
        },
        defaultConfig
      );
    } catch (err) {
      didFail = true;
      expect(err.message).to.equal("Some AWS error");
    }

    expect(didFail).to.equal(true);
  });
});

describe("buildSdk", () => {
  forEach([
    "AWS_CONTAINER_CREDENTIALS_FULL_URI",
    "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
  ]).it("return the codebuild client when env variable %s exists", (key) => {
    process.env[key] = "testUri";
    const test = buildSdk();
    expect(test).to.haveOwnProperty("codeBuild");
    expect(test).to.haveOwnProperty("cloudWatchLogs");
  });
});

function help(builds, logs) {
  const codeBuild = {
    batchGetBuilds() {
      return {
        async promise() {
          return ret(builds);
        },
      };
    },
  };

  const cloudWatchLogs = {
    getLogEvents() {
      return {
        async promise() {
          return ret(logs);
        },
      };
    },
  };

  return { codeBuild, cloudWatchLogs };

  function ret(thing) {
    if (typeof thing === "function") return thing();
    return thing;
  }
}
