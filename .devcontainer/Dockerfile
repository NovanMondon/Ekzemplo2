# syntax=docker/dockerfile:1

# Debian bookworm base, install Node.js 22 + tooling manually.
FROM debian:bookworm-slim

ARG NODE_MAJOR=22

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		gnupg \
		git \
		build-essential \
		python3 \
		bash \
		sudo \
	&& mkdir -p /etc/apt/keyrings \
	&& curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
	&& echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends nodejs \
	&& rm -rf /var/lib/apt/lists/*

# Non-root user to match devcontainer.json (remoteUser: node)
RUN groupadd --gid 1000 node \
	&& useradd --uid 1000 --gid 1000 -m -s /bin/bash node \
	&& echo "node ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/node \
	&& chmod 0440 /etc/sudoers.d/node

WORKDIR /workspaces/Ekzemplo2

USER node
