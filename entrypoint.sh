#!/bin/bash
set -eu

GIT_USER_NAME=${1}
GIT_USER_EMAIL=${2}
PACKAGE_MANAGER=${3}
VERSION_TYPE=${4}

if [ "${PACKAGE_MANAGER}" == 'npm' ]; then
  npm version --no-git-tag-version ${VERSION_TYPE}
elif [ "${PACKAGE_MANAGER}" == 'yarn' ]; then
  yarn version --no-git-tag-version "--${VERSION_TYPE}"
fi

DESCRIPTION="chore: bump ${VERSION_TYPE} version ($(date -I))"
PR_BRANCH=chore/version-$(date +%s)

git config user.name ${GIT_USER_NAME}
git config user.email ${GIT_USER_EMAIL}
git checkout -b ${PR_BRANCH}
git commit -am "${DESCRIPTION}"
git push origin ${PR_BRANCH}

curl -fsSL https://github.com/github/hub/raw/master/script/get | bash -s 2.14.1
bin/hub pull-request -m "${DESCRIPTION}"
