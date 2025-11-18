FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    bc \
    time \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /work /problems

# Copy wrapper script từ cùng thư mục với Dockerfile
COPY ../wrapper.sh /usr/local/bin/wrapper.sh
RUN chmod +x /usr/local/bin/wrapper.sh

WORKDIR /work

CMD ["/bin/bash"]