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

# Solidity compilers
RUN mkdir -p /opt/solc-versions && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.4.26/solc-static-linux -o /opt/solc-versions/solc-0.4.26 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.5.17/solc-static-linux -o /opt/solc-versions/solc-0.5.17 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.6.12/solc-static-linux -o /opt/solc-versions/solc-0.6.12 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.7.6/solc-static-linux -o /opt/solc-versions/solc-0.7.6 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux -o /opt/solc-versions/solc-0.8.20 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.8.24/solc-static-linux -o /opt/solc-versions/solc-0.8.24 && \
    curl -fL https://github.com/ethereum/solidity/releases/download/v0.8.36/solc-static-linux -o /opt/solc-versions/solc-0.8.36 && \
    chmod +x /opt/solc-versions/solc-* && \
    ln -sf /opt/solc-versions/solc-0.8.24 /usr/local/bin/solc && \
    /usr/local/bin/solc --version

# Application
COPY server ./server
COPY security-tools ./security-tools

ENV PORT=5000

EXPOSE 5000

CMD ["node", "server/server.js"]