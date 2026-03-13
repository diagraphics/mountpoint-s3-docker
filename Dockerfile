#
# Fetch Layer
#

FROM curlimages/curl AS fetch

ARG TARGETARCH

COPY ./targetarch /targetarch

RUN mkdir -p /tmp/mountpoint-s3 && \
    curl -SL "https://s3.amazonaws.com/mountpoint-s3-release/latest/$(/targetarch -x arm64)/mount-s3.deb" \
        -o /tmp/mountpoint-s3/mount-s3.deb

RUN mkdir -p /tmp/awscli && \
    curl -SL "https://awscli.amazonaws.com/awscli-exe-linux-$(/targetarch).zip" -o /tmp/awscli/awscliv2.zip &&\
    unzip /tmp/awscli/awscliv2.zip -d /tmp/awscli

#
# Base Layer
#

FROM ghcr.io/diagraphics/s6-overlay-dist:latest AS s6-overlay
FROM debian:bookworm-slim AS base

COPY --from=fetch /tmp/mountpoint-s3 /tmp/mountpoint-s3

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
        ca-certificates \
        media-types \
        /tmp/mountpoint-s3/mount-s3.deb \
 && apt-get clean && rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

COPY --from=s6-overlay / /
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
