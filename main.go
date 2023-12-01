package main

import (
	build "codeberg.org/devthefuture/dockerfile-x/pkg/build"
	"github.com/moby/buildkit/frontend/gateway/grpcclient"
	"github.com/moby/buildkit/util/appcontext"
)

func main() {
	if err := grpcclient.RunFromEnvironment(appcontext.Context(), build.Build); err != nil {
		panic(err)
	}
}
