package main

import (
	llbUtils "codeberg.org/devthefuture/dockerfile-x/pkg/llb"
	"github.com/moby/buildkit/frontend/gateway/grpcclient"
	"github.com/moby/buildkit/util/appcontext"
)

func main() {
	if err := grpcclient.RunFromEnvironment(appcontext.Context(), llbUtils.Build); err != nil {
		panic(err)
	}
}
