package main

import (
	"codeberg.org/devthefuture/dockerfile-x/pkg/build"
	"github.com/moby/buildkit/frontend/gateway/grpcclient"
	"github.com/moby/buildkit/util/appcontext"
	"github.com/sirupsen/logrus"
)

func main() {
	if err := grpcclient.RunFromEnvironment(appcontext.Context(), build.Build); err != nil {
		logrus.Errorf("fatal error: %+v", err)
		panic(err)
	}
}
