FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    build-essential \
    g++-11 \
    time \
    jq \
    python3.10 \
    python3-pip \
    python3-dev \
    bc \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir \
        numpy scipy sympy sortedcontainers networkx

RUN useradd -m -s /bin/bash judgeuser && \
    mkdir -p /work /scripts && \
    chown -R judgeuser:judgeuser /work

# Copy runner scripts
COPY run_and_measure.sh /scripts/run_and_measure.sh

# Convert line endings to Unix format
RUN dos2unix /scripts/run_and_measure.sh

RUN chmod +x /scripts/*.sh

WORKDIR /work
USER judgeuser

CMD ["/bin/bash"]