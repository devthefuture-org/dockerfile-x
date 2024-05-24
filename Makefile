# DOCKER
PACKAGE_VERSION := $(shell jq -r '.version' package.json)
PACKAGE_MAJOR_VERSION := $(shell echo $(PACKAGE_VERSION) | cut -d. -f1)

setup-docker-multiarch:
	docker buildx create --use --name mybuilder --driver docker-container
	docker buildx inspect mybuilder --bootstrap

docker-build-dev:
	docker buildx build --platform linux/amd64 -t devthefuture/dockerfile-x:dev --progress=plain . --push

docker-build:
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x --progress=plain .

docker-push:
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x --progress=plain . --push
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x:v$(PACKAGE_MAJOR_VERSION) --progress=plain . --push
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x:v$(PACKAGE_VERSION) --progress=plain . --push
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x:$(PACKAGE_MAJOR_VERSION) --progress=plain . --push
	docker buildx build --platform linux/amd64,linux/arm64 -t devthefuture/dockerfile-x:$(PACKAGE_VERSION) --progress=plain . --push

# GO

go-version:
	gvm install go1.21
	gvm use 1.21
	
go-deps:
	go mod tidy
	go mod vendor

go-build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod vendor -ldflags '-w -extldflags "-static"' -o dist-bin/dockerfile-x-frontend .


# NODE

node-deps:
	yarn

node-build: node-deps
	yarn build

