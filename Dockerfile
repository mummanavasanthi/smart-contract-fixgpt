FROM node:22-bookworm

RUN apt-get update && \
    apt-get install -y python3 python3-venv python3-pip curl git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend dependencies
COPY server/package*.json ./server/
RUN cd /app/server && npm install --omit=dev

# Slither
RUN python3 -m venv /opt/slither-venv && \
    /opt/slither-venv/bin/pip install --upgrade pip && \
    /opt/slither-venv/bin/pip install slither-analyzer

# Solidity compiler
RUN curl -L \
    https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux \
    -o /usr/local/bin/solc && \
    chmod +x /usr/local/bin/solc

# Application
COPY server ./server
COPY security-tools ./security-tools

ENV PORT=5000

EXPOSE 5000

CMD ["node", "server/server.js"]