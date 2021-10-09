#!/usr/bin/env bash

REPO=$(dirname $0)/..

set -a
source $REPO/.env
set +a

if ! which envsubst &> /dev/null; then
  curl -L https://github.com/a8m/envsubst/releases/download/v1.2.0/envsubst-`uname -s`-`uname -m` -o envsubst
  chmod +x envsubst
  sudo mv envsubst /usr/local/bin
fi

# define k8s secrets and configs
export COMMIT_SHA=$(git rev-parse --verify HEAD)

export HACKMD_EMAIL="$(echo -n $HACKMD_EMAIL | base64)"
export HACKMD_PASSWORD="$(echo -n $HACKMD_PASSWORD | base64)"
export AWS_ACCESS_KEY_ID="$(echo -n $AWS_ACCESS_KEY_ID | base64)"
export AWS_SECRET_ACCESS_KEY="$(echo -n $AWS_SECRET_ACCESS_KEY | base64)"

envsubst < $REPO/k8s/app-secrets.yml.tmpl > $REPO/k8s/app-secrets.yml
envsubst < $REPO/k8s/app-configmaps.yml.tmpl > $REPO/k8s/app-configmaps.yml
envsubst < $REPO/k8s/app-cronjob.yml.tmpl > $REPO/k8s/app-cronjob.yml
envsubst < $REPO/k8s/app-depl.yml.tmpl > $REPO/k8s/app-depl.yml
envsubst < $REPO/k8s/chrome-depl.yml.tmpl > $REPO/k8s/chrome-depl.yml

if which docker &> /dev/null; then
  # build image and push
  docker build -t $DOCKER_IMAGE:$COMMIT_SHA .
  docker push $DOCKER_IMAGE:$COMMIT_SHA

  # create namespace
  kubectl get ns --kubeconfig ~/.kube/lke.yaml | grep $K8S_NAMESPACE
  if [ $? == 1 ]; then
    kubectl create ns $K8S_NAMESPACE --kubeconfig ~/.kube/lke.yaml
  fi

  # apply k8s deployment
  kubectl apply -f $REPO/k8s --kubeconfig ~/.kube/lke.yaml
else
  echo "Is the docker daemon running?"
fi
