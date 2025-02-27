#
# Fetch Layer
#

FROM curlimages/curl AS fetch
RUN \
    mkdir -p /tmp/mountpoint-s3 && \
    curl -SL https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb \
    -o /tmp/mountpoint-s3/mount-s3.deb
RUN mkdir -p /tmp/awscli && \
    curl -SL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli/awscliv2.zip && \
    unzip /tmp/awscli/awscliv2.zip -d /tmp/awscli

#
# Debian Base
#

FROM debian:bookworm-slim AS debian-base

RUN apt-get update && apt-get install -y \
        curl \
        gnupg2 \
        ca-certificates \
        lsb-release \
        debian-keyring \
        debian-archive-keyring \
        apt-transport-https \
        gettext-base

RUN curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor \
  | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null \
 && echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/debian $(lsb_release -cs) nginx" \
  | tee /etc/apt/sources.list.d/nginx.list \
 && echo "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" \
  | tee /etc/apt/preferences.d/99nginx \
 && apt-get update && apt-get install -y \
        nginx \
        nginx-module-njs \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=fetch /tmp/mountpoint-s3 /tmp/mountpoint-s3
RUN apt-get update && apt-get install -y \
        media-types \
        /tmp/mountpoint-s3/mount-s3.deb \
 && apt-get clean && rm -rf /var/lib/apt/lists/* \
 && rm -rf /tmp/*

FROM ghcr.io/diagraphics/s6-overlay-dist:latest AS s6-overlay

## Base Layer ##

FROM debian-base AS base

COPY --from=s6-overlay / /

COPY ./docker/s6-rootfs/ /
ENTRYPOINT [ "/init" ]

# RUN echo "user_allow_other" >> /etc/fuse.conf

# COPY --chmod=555 docker-entrypoint.sh /docker-entrypoint.sh

# RUN mkdir -p /var/cache/mount-s3

# # COPY /conf/nginx-proxy.conf /etc/nginx/nginx.conf

# # COPY --chmod=555 nginx-entrypoint.sh /docker-entrypoint.sh


FROM base AS dev

COPY --from=fetch /tmp/awscli /tmp/awscli
RUN /tmp/awscli/aws/install \
    && rm -rf /tmp/*

FROM base AS prod


