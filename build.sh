#!/bin/bash

# Build angular
ng build

# Delete statik
rm -rf statik

# generate binary package
static -src=dist/kube-dashboard

# rebuild binary
go build -o kube-dashboard main.go
