// Package dtp provides APIs to build a high-level frontend that simply transforms the Dockerfiles.
package dtp

import (
	"errors"
	"fmt"
	"reflect"
	"unsafe"

	"github.com/moby/buildkit/frontend/gateway/client"
	pb "github.com/moby/buildkit/frontend/gateway/pb"
)

// DockerfileTransform specifies a function used to transform source
// Dockerfile into desired form. Note that resulting Dockerfile must be valid.
type DockerfileTransform func(dockerfile []byte) ([]byte, error)

const fieldLLBClient = "client"

// InjectDockerfileTransform modifies provided client to use a proxy that
// transforms user-supplied Dockerfile.
func InjectDockerfileTransform(transform DockerfileTransform, client client.Client) (err error) {
	// Catch panics
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("paniced: %v", r)
		}
	}()

	// Extract the LLB client
	llb, ok := getUnexportedField(reflect.ValueOf(client).Elem().FieldByName(fieldLLBClient)).(pb.LLBBridgeClient)
	if !ok {
		err = errors.New("unexpected client type")
		return
	}
	// Inject a proxy around the LLB client
	opts := client.BuildOpts().Opts
	opts["frontend.caps"] = "moby.buildkit.frontend.contexts"
	proxy := NewDockerfileTransformingLLBProxy(llb, opts, transform)
	setUnexportedField(reflect.ValueOf(client).Elem().FieldByName(fieldLLBClient), proxy)
	err = nil
	return
}

// Taken from https://stackoverflow.com/questions/42664837/how-to-access-unexported-struct-fields/43918797#43918797
func getUnexportedField(field reflect.Value) interface{} {
	return reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).Elem().Interface()
}

func setUnexportedField(field reflect.Value, value interface{}) {
	reflect.NewAt(field.Type(), unsafe.Pointer(field.UnsafeAddr())).
		Elem().
		Set(reflect.ValueOf(value))
}
