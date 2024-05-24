// based on https://github.com/EricHripko/buildkit-fdk/
package build

import (
	"context"

	"codeberg.org/devthefuture/dockerfile-x/pkg/dtp"

	dockerfile "github.com/moby/buildkit/frontend/dockerfile/builder"
	"github.com/moby/buildkit/frontend/gateway/client"
)

func Build(ctx context.Context, c client.Client) (*client.Result, error) {
	// Concatenate user-supplied Dockerfile with vendored ones
	transform := func(dockerfile []byte) ([]byte, error) {
		result, err := loadDockerfileX(ctx, c, dockerfile)
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	if err := dtp.InjectDockerfileTransform(transform, c); err != nil {
		return nil, err
	}

	// Pass control to the upstream Dockerfile frontend
	return dockerfile.Build(ctx, c)
}
