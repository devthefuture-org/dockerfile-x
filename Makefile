# ===== Variables =====
PACKAGE_VERSION := $(shell jq -r '.version' package.json)
PACKAGE_MAJOR_VERSION := $(shell echo $(PACKAGE_VERSION) | cut -d. -f1)
REPO := devthefuture/dockerfile-x
PLATFORMS := linux/amd64,linux/arm64

# ===== Docker =====
setup-docker-multiarch:
	docker buildx create --use --name mybuilder --driver docker-container || true
	docker buildx inspect mybuilder --bootstrap

docker-build-dev:
	docker buildx build --progress=plain --platform linux/amd64 -t $(REPO):dev . --push

docker-build:
	docker buildx build --progress=plain --platform $(PLATFORMS) -t $(REPO) .

docker-push:
	docker buildx build \
		--progress=plain \
		--platform $(PLATFORMS) \
		-t $(REPO) \
		-t $(REPO):$(PACKAGE_MAJOR_VERSION) \
		-t $(REPO):v$(PACKAGE_MAJOR_VERSION) \
		-t $(REPO):$(PACKAGE_VERSION) \
		-t $(REPO):v$(PACKAGE_VERSION) \
		. --push

# ===== Go =====
go-version:
	gvm install go1.25 || true
	gvm use 1.25

go-deps:
	go mod tidy
	go mod vendor

go-build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
		go build -mod=vendor -trimpath -ldflags='-s -w -extldflags "-static"' \
		-o dist-bin/dockerfile-x-frontend .

# ===== Node =====
node-deps:
	yarn

node-build: node-deps
	yarn build