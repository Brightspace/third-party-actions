#!/bin/bash
set -eu

GIT_USER_NAME=${1}
GIT_USER_EMAIL=${2}
PACKAGE_MANAGER=${3}
VERSION_TYPE=${4}
BRANCH=${5}
PR_DESCRIPTION=${6}
PUSH_OPTIONS=${7}

if [ "${PACKAGE_MANAGER}" == 'npm' ]; then
  npm version --no-git-tag-version ${VERSION_TYPE}
elif [ "${PACKAGE_MANAGER}" == 'yarn' ]; then
  yarn version --no-git-tag-version "--${VERSION_TYPE}"
fi

if [ -n "${PR_DESCRIPTION}" ]; then
  DESCRIPTION=${PR_DESCRIPTION}
else 
  DESCRIPTION="chore: bump ${VERSION_TYPE} version ($(date -I))"
fi

if [ -n "${BRANCH}" ]; then
  PR_BRANCH=${BRANCH}
else 
  PR_BRANCH=chore/version-$(date +%s)
fi

git config user.name ${GIT_USER_NAME}
git config user.email ${GIT_USER_EMAIL}
git checkout -b ${PR_BRANCH}
git commit -am "${DESCRIPTION}"
git push ${PUSH_OPTIONS} origin ${PR_BRANCH}

curl -fsSL https://github.com/github/hub/raw/master/script/get | bash -s 2.14.1
bin/hub pull-request -m "${DESCRIPTION}"
