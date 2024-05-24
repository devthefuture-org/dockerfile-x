package dtp

import (
	"context"

	pb "github.com/moby/buildkit/frontend/gateway/pb"
	"google.golang.org/grpc"
)

const (
	defaultDockerfileName = "Dockerfile"
	keyFilename           = "filename"
)

//go:generate mockgen -package dtp_mock -destination mock/client.go github.com/moby/buildkit/frontend/gateway/pb LLBBridgeClient,LLBBridge_ExecProcessClient

// NewDockerfileTransformingLLBProxy returns a new proxy for the given client
// object. It applies the specified transform to the Dockerfile after it was
// read from the build context.
func NewDockerfileTransformingLLBProxy(client pb.LLBBridgeClient, opts map[string]string, transform DockerfileTransform) pb.LLBBridgeClient {
	dockerfile := defaultDockerfileName
	if v, ok := opts[keyFilename]; ok {
		dockerfile = v
	}

	return &dockerfileTransformingLLBProxy{client, dockerfile, transform}
}

type dockerfileTransformingLLBProxy struct {
	client     pb.LLBBridgeClient
	dockerfile string
	transform  DockerfileTransform
}

func (proxy *dockerfileTransformingLLBProxy) ResolveImageConfig(ctx context.Context, in *pb.ResolveImageConfigRequest, opts ...grpc.CallOption) (*pb.ResolveImageConfigResponse, error) {
	return proxy.client.ResolveImageConfig(ctx, in, opts...)
}
func (proxy *dockerfileTransformingLLBProxy) Solve(ctx context.Context, in *pb.SolveRequest, opts ...grpc.CallOption) (*pb.SolveResponse, error) {
	return proxy.client.Solve(ctx, in, opts...)
}
func (proxy *dockerfileTransformingLLBProxy) ResolveSourceMeta(ctx context.Context, in *pb.ResolveSourceMetaRequest, opts ...grpc.CallOption) (*pb.ResolveSourceMetaResponse, error) {
	return proxy.client.ResolveSourceMeta(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) ReadFile(ctx context.Context, in *pb.ReadFileRequest, opts ...grpc.CallOption) (*pb.ReadFileResponse, error) {
	res, err := proxy.client.ReadFile(ctx, in, opts...)
	if err == nil && in.FilePath == proxy.dockerfile {
		res.Data, err = proxy.transform(res.Data)
	}
	return res, err
}

func (proxy *dockerfileTransformingLLBProxy) ReadDir(ctx context.Context, in *pb.ReadDirRequest, opts ...grpc.CallOption) (*pb.ReadDirResponse, error) {
	return proxy.client.ReadDir(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) StatFile(ctx context.Context, in *pb.StatFileRequest, opts ...grpc.CallOption) (*pb.StatFileResponse, error) {
	return proxy.client.StatFile(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) Ping(ctx context.Context, in *pb.PingRequest, opts ...grpc.CallOption) (*pb.PongResponse, error) {
	return proxy.client.Ping(ctx, in, opts...)

}

func (proxy *dockerfileTransformingLLBProxy) Return(ctx context.Context, in *pb.ReturnRequest, opts ...grpc.CallOption) (*pb.ReturnResponse, error) {
	return proxy.client.Return(ctx, in, opts...)

}

func (proxy *dockerfileTransformingLLBProxy) Inputs(ctx context.Context, in *pb.InputsRequest, opts ...grpc.CallOption) (*pb.InputsResponse, error) {
	return proxy.client.Inputs(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) NewContainer(ctx context.Context, in *pb.NewContainerRequest, opts ...grpc.CallOption) (*pb.NewContainerResponse, error) {
	return proxy.client.NewContainer(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) ReleaseContainer(ctx context.Context, in *pb.ReleaseContainerRequest, opts ...grpc.CallOption) (*pb.ReleaseContainerResponse, error) {
	return proxy.client.ReleaseContainer(ctx, in, opts...)
}
func (proxy *dockerfileTransformingLLBProxy) ExecProcess(ctx context.Context, opts ...grpc.CallOption) (pb.LLBBridge_ExecProcessClient, error) {
	return proxy.client.ExecProcess(ctx, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) Warn(ctx context.Context, in *pb.WarnRequest, opts ...grpc.CallOption) (*pb.WarnResponse, error) {
	return proxy.client.Warn(ctx, in, opts...)
}

func (proxy *dockerfileTransformingLLBProxy) Evaluate(ctx context.Context, in *pb.EvaluateRequest, opts ...grpc.CallOption) (*pb.EvaluateResponse, error) {
	return proxy.client.Evaluate(ctx, in, opts...)
}
