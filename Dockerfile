#
# Fetch Layer
#

FROM curlimages/curl AS fetch

RUN mkdir -p /tmp/mountpoint-s3 && \
    curl -SL https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb?v=1 \
    -o /tmp/mountpoint-s3/mount-s3.deb

RUN mkdir -p /tmp/awscli &&     \
    curl -SL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli/awscliv2.zip && \
    unzip /tmp/awscli/awscliv2.zip -d /tmp/awscli

RUN mkdir -p /tmp/trurl && \
    curl -SL https://github.com/curl/trurl/releases/download/trurl-0.16/trurl-0.16.tar.gz | \
    tar --extract --gzip --strip-components=1 --directory=/tmp/trurl


#
# OS Layer
#

FROM debian:bookworm-slim AS debian-base

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
        curl \
        libcurl3-gnutls \
        gnupg2 \
        netcat-openbsd \
        ca-certificates \
        lsb-release \
        debian-keyring \
        debian-archive-keyring \
        apt-transport-https \
        gettext-base

RUN curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
  | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/debian $(lsb_release -cs) nginx" \
  | tee /etc/apt/sources.list.d/nginx.list && \
    echo "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" \
  | tee /etc/apt/preferences.d/99nginx && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
        nginx \
        nginx-module-njs \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=fetch /tmp/mountpoint-s3 /tmp/mountpoint-s3

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
        media-types \
        /tmp/mountpoint-s3/mount-s3.deb \
 && apt-get clean && rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*


#
# Build trurl
#

FROM debian-base AS builder

WORKDIR /build

COPY --from=fetch /tmp/trurl /build

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
        libcurl4-gnutls-dev \
        g++ \
        make \
 && rm -rf /var/lib/apt/lists/*

RUN make


#
# Base Layer
#

FROM ghcr.io/diagraphics/s6-overlay-dist:latest AS s6-overlay
FROM debian-base AS base

COPY --from=s6-overlay / /
COPY --from=builder /build/trurl /command/trurl
COPY ./rootfs/ /

# Create a service for each bucket that is to be mounted,
# and fail fast if an error occurs.
ENV S6_STAGE2_HOOK=/etc/s6-overlay/stage2_hook.sh \
    S6_BEHAVIOUR_IF_STAGE2_FAILS=2

# Since we are using a fuse filesystem, attempt to ensure that
# file data is flushed before the container exits.
ENV S6_SYNC_DISKS=1

ENTRYPOINT [ "/init" ]


#
# Dev Layer
#

FROM base AS dev

COPY --from=fetch /tmp/awscli /tmp/awscli
RUN /tmp/awscli/aws/install \
    && rm -rf /tmp/*


#
# Production Layer
#

FROM base AS prod
