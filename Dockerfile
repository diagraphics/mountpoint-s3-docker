FROM curlimages/curl AS fetch
RUN \
    mkdir -p /tmp/mountpoint-s3 && \
    curl -SL https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb \
    -o /tmp/mountpoint-s3/mount-s3.deb
RUN mkdir -p /tmp/awscli && \
    curl -SL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscli/awscliv2.zip && \
    unzip /tmp/awscli/awscliv2.zip -d /tmp/awscli

FROM debian:bookworm-slim AS base

COPY --from=fetch /tmp/mountpoint-s3 /tmp/mountpoint-s3
RUN apt-get update && apt-get install -y \
    /tmp/mountpoint-s3/mount-s3.deb \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/*

RUN echo "user_allow_other" >> /etc/fuse.conf

COPY --chmod=555 docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /var/cache/mount-s3

FROM base AS dev

COPY --from=fetch /tmp/awscli /tmp/awscli
RUN /tmp/awscli/aws/install \
    && rm -rf /tmp/*


FROM dev AS demo

RUN apt-get update && apt-get install -y \
    debian-keyring \
    debian-archive-keyring \
    apt-transport-https \
    curl

RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list

RUN apt-get update && apt-get install -y caddy s3fs \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=555 demo-entrypoint.sh /demo-entrypoint.sh
COPY dotfiles/config /root/.aws/config
COPY dotfiles/credentials /root/.aws/credentials
ENTRYPOINT [ "/demo-entrypoint.sh" ]


FROM base AS prod

ENTRYPOINT [ "/docker-entrypoint.sh" ]

