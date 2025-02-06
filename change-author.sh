#!/bin/bash
git filter-branch --env-filter '
if [ "$GIT_COMMITTER_EMAIL" = "dev@hongwu.xyz" ]
then
    export GIT_COMMITTER_NAME="klynwuu"
    export GIT_COMMITTER_EMAIL="klynwuu@email.com"
fi
if [ "$GIT_AUTHOR_EMAIL" = "dev@hongwu.xyz" ]
then
    export GIT_AUTHOR_NAME="klynwuu"
    export GIT_AUTHOR_EMAIL="klynwuu@email.com"
fi
' --tag-name-filter cat -- --branches --tags 