#!/bin/bash

source ~/.nvm/nvm.sh

# Build angular
ng build

# Delete statik
rm -rf statik

# generate binary package
statik -src=dist/kube-dashboard

# rebuild binary
go build -o kube-dashboard main.go
