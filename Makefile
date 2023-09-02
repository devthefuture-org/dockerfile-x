# DOCKER

docker-build:
	docker build -t devthefuture/dockerfile-x --progress=plain .

docker-push:
	docker push devthefuture/dockerfile-x


# GO

go-version:
	gvm use 1.19
	
go-deps:
	go mod tidy
	go mod vendor

go-build: go-deps
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod vendor -ldflags '-w -extldflags "-static"' -o dist-bin/dockerfile-x-frontend .


# NODE

node-deps:
	yarn

node-build: node-deps
	yarn build

