FROM debian:stable-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ make bash time && rm -rf /var/lib/apt/lists/*
WORKDIR /work
# user không đặc quyền
RUN useradd -m runner
USER runner
