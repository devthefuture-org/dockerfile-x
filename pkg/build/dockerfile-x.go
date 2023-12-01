package build

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/moby/buildkit/client/llb"

	// "github.com/moby/buildkit/exporter/containerimage/exptypes"

	"github.com/moby/buildkit/frontend/dockerui"
	"github.com/moby/buildkit/frontend/gateway/client"
	"github.com/pkg/errors"
)

const (
	defaultDockerfileName = "Dockerfile"
	localNameConfig       = "dockerfile"
	localNameContext      = "context"
	keyConfigPath         = "filename"
	defaultExtension      = ".dockerfile"
)

func loadFileFromContext(ctx context.Context, c client.Client, localCtx string, filename string) ([]byte, error) {
	name := "load definition"
	if filename != "Dockerfile" {
		name += " from " + filename
	}
	src := llb.Local(
		localCtx,
		llb.IncludePatterns([]string{filename}),
		llb.SessionID(c.BuildOpts().SessionID),
		llb.SharedKeyHint(defaultDockerfileName),
	)
	def, err := src.Marshal(context.TODO())
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal local source")
	}
	res, err := c.Solve(ctx, client.SolveRequest{
		Definition: def.ToPB(),
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create solve request")
	}
	ref, err := res.SingleRef()
	if err != nil {
		return nil, err
	}

	var xdockerfile []byte
	xdockerfile, err = ref.ReadFile(ctx, client.ReadRequest{
		Filename: filename,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to read dockerfile '%s': %s\n", filename, err)
	}
	return xdockerfile, nil
}

func loadDockerfileX(ctx context.Context, c client.Client, src *dockerui.Source) (err error) {
	buildOpts := c.BuildOpts()
	opts := buildOpts.Opts
	filename := opts[keyConfigPath]
	if filename == "" {
		filename = defaultDockerfileName
	}
	result, err := tryDockerfileX(ctx, c, filename)
	if err != nil {
		return fmt.Errorf("failed to execute dockerfile-x: %s, Output: %s\n", err, result)
	}
	src.SourceMap.Data = []byte(result)
	return nil
}

func EnsureDir(filePath string, perm os.FileMode) error {
	// Extract the directory part of the file path.
	dir := filepath.Dir(filePath)

	// Check if the directory exists.
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		// The directory does not exist, so create it.
		return os.MkdirAll(dir, perm)
	}
	return nil
}

func tryDockerfileX(ctx context.Context, c client.Client, filename string) (result string, err error) {
	var lastMissingFile string

	xdockerfile, err := loadFileFromContext(ctx, c, localNameConfig, filename)
	if err != nil {
		return "", fmt.Errorf("failed to load dockerfile '%s' from context: %s\n", filename, err)
	}

	uniqFilename := fmt.Sprintf("%s_%d", filename, time.Now().Unix())
	if err = EnsureDir(uniqFilename, 0755); err != nil {
		return "", fmt.Errorf("Error creating parent dir for file '%s': %s\n", uniqFilename, err)
	}
	if err = ioutil.WriteFile(uniqFilename, xdockerfile, 0644); err != nil {
		return "", fmt.Errorf("Error writing to file '%s': %s\n", uniqFilename, err)
	}

	for {
		cmd := exec.Command("dockerfile-x", "-f", uniqFilename)

		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()

		exitCode := 0
		if exitErr, ok := err.(*exec.ExitError); ok {
			if status, ok := exitErr.Sys().(syscall.WaitStatus); ok {
				exitCode = status.ExitStatus()
			}
		}

		switch exitCode {
		case 0:
			return stdout.String(), nil
		case 2:
			var result map[string]string
			output := stdout.Bytes()
			if err := json.Unmarshal(output, &result); err != nil {
				return "", fmt.Errorf("Error parsing JSON output: %v", err)
			}
			if missingFile, ok := result["filename"]; ok {
				if missingFile == lastMissingFile {
					return "", fmt.Errorf("Same missing file encountered twice consecutively: %s", missingFile)
				}
				lastMissingFile = missingFile

				content, err := loadFileFromContext(ctx, c, localNameContext, missingFile)
				if err != nil && !strings.HasSuffix(missingFile, defaultExtension) {
					missingFile = missingFile + defaultExtension
					content, err = loadFileFromContext(ctx, c, localNameContext, missingFile)
				}

				if err != nil {
					return "", err
				}
				if err = os.MkdirAll(path.Dir(missingFile), 0755); err != nil {
					return "", err
				}
				if err = ioutil.WriteFile(missingFile, content, 0644); err != nil {
					return "", fmt.Errorf("Error writing to file '%s': %s\n", missingFile, err)
				}
				continue
			}
			return "", fmt.Errorf("Command failed with exit code 2, but missing file not found. Output: %s %s", string(output), stderr.String())
		default:
			return "", fmt.Errorf("Unknown error occurred: %s %s", stdout.String(), stderr.String())
		}
	}
}
